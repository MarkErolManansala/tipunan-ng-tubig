import { createDamsRepository } from "@/features/dams/repositories/dams-repository";
import type { DamsRepository } from "@/features/dams/repositories/dams-repository";
import type { SyncRunsRepository } from "@/features/dams/repositories/sync-runs-repository";
import { createSyncRunsRepository } from "@/features/dams/repositories/sync-runs-repository";
import { DAMS_SYNC_KIND } from "@/features/dams/sync/sync-dams";
import { createPublicSupabaseClient } from "@/lib/supabase/server";
import type {
  DamReadingRow,
  DamThresholds,
  LatestDamReadingRow,
} from "@/types/database";
import type { Json } from "@/types/database.types";

/**
 * Read-side dam service: shapes repository rows into the domain view models
 * the UI renders. Write-side sync logic lives in `features/dams/sync/`.
 */

/** A single dam reading, camelCase for the UI; null means unknown, never zero. */
export interface DamReadingView {
  observedAt: string;
  levelM: number | null;
  ruleCurveM: number | null;
  normalHighM: number | null;
  change24hM: number | null;
  source: string | null;
}

/** A dam with its most recent reading, or null when it has none yet. */
export interface DamSummary {
  id: string;
  name: string;
  thresholds: DamThresholds;
  latest: DamReadingView | null;
}

/** A dam with its recent reading history, newest first. */
export interface DamDetail {
  id: string;
  name: string;
  thresholds: DamThresholds;
  /** When the dam row was last synced from the Tubig API, or unknown. */
  updatedAt: string | null;
  readings: DamReadingView[];
}

export interface DamsServiceDeps {
  dams: DamsRepository;
  syncRuns: SyncRunsRepository;
}

export interface DamsService {
  /** All dams with their latest reading, ordered by name. */
  listDamSummaries(): Promise<DamSummary[]>;
  /** One dam with its recent readings, or null when the id is unknown. */
  getDamDetail(id: string): Promise<DamDetail | null>;
  /** When the last successful sync finished, or null if none has. */
  getLastSuccessfulSyncAt(): Promise<string | null>;
}

function toReadingView(
  row: DamReadingRow | LatestDamReadingRow,
): DamReadingView {
  return {
    observedAt: row.observed_at,
    levelM: row.level_m,
    ruleCurveM: row.rule_curve_m,
    normalHighM: row.normal_high_m,
    change24hM: row.change_24h_m,
    source: row.source,
  };
}

/** Narrows the thresholds jsonb to a plain object; anything else becomes {}. */
function toThresholds(json: Json): DamThresholds {
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    return {};
  }
  const thresholds: DamThresholds = {};
  for (const [key, value] of Object.entries(json)) {
    if (value !== undefined) thresholds[key] = value;
  }
  return thresholds;
}

export function createDamsService(deps: DamsServiceDeps): DamsService {
  return {
    async listDamSummaries() {
      const [dams, latestReadings] = await Promise.all([
        deps.dams.listDams(),
        deps.dams.listLatestReadings(),
      ]);
      const latestByDam = new Map(
        latestReadings.map((row) => [row.dam_id, toReadingView(row)]),
      );
      return dams.map((dam) => ({
        id: dam.id,
        name: dam.name,
        thresholds: toThresholds(dam.thresholds),
        latest: latestByDam.get(dam.id) ?? null,
      }));
    },

    async getDamDetail(id) {
      const dam = await deps.dams.getDam(id);
      if (dam === null) return null;
      const readings = await deps.dams.listRecentReadings(id, 30);
      return {
        id: dam.id,
        name: dam.name,
        thresholds: toThresholds(dam.thresholds),
        updatedAt: dam.updated_at,
        readings: readings.map(toReadingView),
      };
    },

    async getLastSuccessfulSyncAt() {
      const run = await deps.syncRuns.getLatestSuccessfulRun(DAMS_SYNC_KIND);
      return run?.finished_at ?? null;
    },
  };
}

/**
 * Service wired to the publishable-key (anon) client for public reads, as
 * constrained by RLS. Use this in server components serving public pages;
 * sync code builds its own deps with the secret-key client instead.
 */
export function createPublicDamsService(): DamsService {
  const supabase = createPublicSupabaseClient();
  return createDamsService({
    dams: createDamsRepository(supabase),
    syncRuns: createSyncRunsRepository(supabase),
  });
}
