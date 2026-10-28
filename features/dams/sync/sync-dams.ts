import type { TubigClient } from "@/lib/tubig/client";
import type { TubigError, TubigResult } from "@/lib/tubig/http";
import type { TubigDam, TubigDamList, TubigDamReading } from "@/lib/tubig/schemas";
import type { DamsRepository } from "@/features/dams/repositories/dams-repository";
import { SyncAlreadyRunningError } from "@/features/dams/repositories/errors";
import type { SyncRunsRepository } from "@/features/dams/repositories/sync-runs-repository";
import type {
  DamInsert,
  DamReadingInsert,
  SyncRunMode,
  SyncRunRow,
} from "@/types/database";

/**
 * Dam synchronization: fetches dam metadata, latest readings, and historical
 * readings from the Tubig API and upserts them idempotently into Supabase.
 *
 * Design rules (see .ai/rules/* and .agent/skills/tubig-api-sync/SKILL.md):
 * - One run = create `sync_runs` row → fetch → upsert → finalize row.
 * - A run of the same kind cannot run concurrently (database-level lock).
 * - Backfill mode is resumable: per-dam cursors are persisted as progress so
 *   an interrupted run continues where it stopped.
 * - Upserts conflict on `id` (dams) and `(dam_id, observed_at)` (readings), so
 *   repeated runs never duplicate data.
 */

export const DAMS_SYNC_KIND = "dams";

/** Hard cap on dam-list pages; the whole list is expected to fit in one page. */
const MAX_DAM_LIST_PAGES = 10;

export type SyncOutcome =
  | { ok: true; runId: number; pagesFetched: number; itemsUpserted: number }
  | { ok: false; code: "already-running" | "sync-failed"; message: string };

export interface SyncDamsDeps {
  dams: DamsRepository;
  syncRuns: SyncRunsRepository;
  tubig: TubigClient;
  /** Dam-list page limit; 500 is the API maximum. Default 500. */
  damListLimit?: number;
  /** Readings page limit; 500 is the API maximum. Default 500. */
  readingsLimit?: number;
  /** Safety cap on pages fetched per dam per backfill run. Default 200. */
  maxBackfillPagesPerDam?: number;
}

/** Converts a transport/parse failure into a thrown sync error. */
class TubigSyncError extends Error {
  readonly upstream: TubigError;

  constructor(upstream: TubigError) {
    super(`upstream ${upstream.kind}: ${upstream.message}`);
    this.name = "TubigSyncError";
    this.upstream = upstream;
  }
}

function toUtcIso(observedAt: string): string {
  const date = new Date(observedAt);
  if (Number.isNaN(date.getTime())) {
    throw new TubigSyncError({
      kind: "parse",
      message: `invalid observed_at timestamp: ${observedAt}`,
    });
  }
  return date.toISOString();
}

function mapDamInsert(dam: TubigDam, nowIso: string): DamInsert {
  return {
    id: dam.id,
    name: dam.name,
    // Thresholds are dam-specific keys (or empty); stored verbatim.
    thresholds: dam.thresholds,
    updated_at: nowIso,
  };
}

function mapReadingInsert(
  damId: string,
  reading: TubigDamReading,
): DamReadingInsert {
  return {
    dam_id: damId,
    observed_at: toUtcIso(reading.observed_at),
    level_m: reading.level_m,
    rule_curve_m: reading.rule_curve_m,
    normal_high_m: reading.normal_high_m,
    change_24h_m: reading.change_24h_m,
    source: reading.source,
  };
}

/**
 * Loads per-dam cursors from the most recent backfill run so an interrupted
 * backfill resumes where it stopped. Empty when the previous run finished.
 */
async function loadResumableCursors(
  deps: SyncDamsDeps,
  mode: SyncRunMode,
): Promise<Record<string, string>> {
  if (mode !== "backfill") return {};
  const latest: SyncRunRow | null = await deps.syncRuns.getLatestRun(
    DAMS_SYNC_KIND,
    mode,
  );
  if (latest?.last_cursor && Object.keys(latest.last_cursor).length > 0) {
    return { ...latest.last_cursor };
  }
  return {};
}

/** Fetches and upserts one page (or follows a resume cursor) for a single dam. */
async function syncDamReadingsPage(
  deps: SyncDamsDeps,
  damId: string,
  mode: SyncRunMode,
  cursors: Record<string, string>,
  progress: { pagesFetched: number; itemsUpserted: number },
): Promise<boolean> {
  // `undefined` = start a fresh page; a string = resume from this opaque cursor.
  const resumeCursor = mode === "backfill" ? cursors[damId] : undefined;
  const page =
    resumeCursor === undefined
      ? await deps.tubig.fetchDamReadingsPage({
          damId,
          limit: deps.readingsLimit ?? 500,
        })
      : await deps.tubig.followDamReadingsNext(resumeCursor);
  if (!page.ok) throw new TubigSyncError(page.error);

  progress.pagesFetched += 1;
  progress.itemsUpserted += await deps.dams.upsertReadings(
    page.data.items.map((reading) => mapReadingInsert(damId, reading)),
  );

  const next = page.data.next;
  if (next === null) {
    delete cursors[damId]; // dam fully synced
    return false; // no more pages
  }
  cursors[damId] = next;
  return true; // more pages exist
}

export async function syncDams(
  deps: SyncDamsDeps,
  mode: SyncRunMode = "routine",
): Promise<SyncOutcome> {
  // Load resumable cursors BEFORE creating this run's row — otherwise the
  // latest run would be this (empty, still-running) run itself.
  const resumableCursors = await loadResumableCursors(deps, mode);

  let run: SyncRunRow;
  try {
    run = await deps.syncRuns.createRun(DAMS_SYNC_KIND, mode);
  } catch (error) {
    if (error instanceof SyncAlreadyRunningError) {
      return {
        ok: false,
        code: "already-running",
        message: error.message,
      };
    }
    throw error;
  }

  const progress = { pagesFetched: 0, itemsUpserted: 0 };
  const cursors = resumableCursors;

  try {
    // 1. Fetch the full dam list (follows `next` until null; normally one page).
    const damItems: TubigDam[] = [];
    let damCursor: string | null = null;
    for (let page = 0; page < MAX_DAM_LIST_PAGES; page += 1) {
      const result: TubigResult<TubigDamList> =
        damCursor === null
          ? await deps.tubig.fetchDamsPage({ limit: deps.damListLimit ?? 500 })
          : await deps.tubig.followDamsNext(damCursor);
      if (!result.ok) throw new TubigSyncError(result.error);
      damItems.push(...result.data.items);
      progress.pagesFetched += 1;
      damCursor = result.data.next;
      if (damCursor === null) break;
    }

    // 2. Upsert dam metadata and latest readings.
    const nowIso = new Date().toISOString();
    await deps.dams.upsertDams(damItems.map((dam) => mapDamInsert(dam, nowIso)));
    const latestRows: DamReadingInsert[] = [];
    for (const dam of damItems) {
      if (dam.latest !== null) {
        latestRows.push(mapReadingInsert(dam.id, dam.latest));
      }
    }
    progress.itemsUpserted += await deps.dams.upsertReadings(latestRows);

    // 3. Historical readings, one dam at a time (sequential → respects pacing).
    for (const dam of damItems) {
      // Routine mode: newest page only. Backfill mode: walk pages until null,
      // bounded by maxBackfillPagesPerDam per run; the cursor is persisted so
      // the next run resumes.
      const maxPages =
        mode === "routine" ? 1 : (deps.maxBackfillPagesPerDam ?? 200);
      for (let page = 0; page < maxPages; page += 1) {
        const hasMore = await syncDamReadingsPage(
          deps,
          dam.id,
          mode,
          cursors,
          progress,
        );
        if (!hasMore) break;
      }
      if (mode === "backfill") {
        // Persist progress after every dam so a failure never loses cursors.
        await deps.syncRuns.saveProgress(run.id, {
          pagesFetched: progress.pagesFetched,
          itemsUpserted: progress.itemsUpserted,
          lastCursor: cursors,
        });
      }
    }

    // Remaining cursors mean the backfill did not finish and continues next run.
    const unfinished = Object.keys(cursors).length > 0 ? cursors : null;
    await deps.syncRuns.finishRun(run.id, {
      status: "succeeded",
      finished_at: new Date().toISOString(),
      pages_fetched: progress.pagesFetched,
      items_upserted: progress.itemsUpserted,
      last_cursor: mode === "backfill" ? unfinished : null,
      error: null,
    });
    return {
      ok: true,
      runId: run.id,
      pagesFetched: progress.pagesFetched,
      itemsUpserted: progress.itemsUpserted,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await deps.syncRuns.finishRun(run.id, {
      status: "failed",
      finished_at: new Date().toISOString(),
      pages_fetched: progress.pagesFetched,
      items_upserted: progress.itemsUpserted,
      last_cursor: mode === "backfill" ? cursors : null,
      error: message,
    });
    return { ok: false, code: "sync-failed", message };
  }
}
