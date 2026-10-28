import type { DamsRepository } from "@/features/dams/repositories/dams-repository";
import {
  RepositoryError,
  SyncAlreadyRunningError,
} from "@/features/dams/repositories/errors";
import type { SyncRunsRepository } from "@/features/dams/repositories/sync-runs-repository";
import type {
  DamInsert,
  DamReadingInsert,
  DamReadingRow,
  DamRow,
  LatestDamReadingRow,
  SyncRunFinish,
  SyncRunMode,
  SyncRunRow,
} from "@/types/database";

/**
 * In-memory repositories that simulate the database's uniqueness constraints
 * (dams by id, readings by dam_id + observed_at) and the running-run lock.
 * Read methods serve configurable row fixtures (`damRows`, `readingRows`,
 * `latestReadingRows`) so service tests don't depend on upsert state.
 */

export class FakeDamsRepository implements DamsRepository {
  dams = new Map<string, DamInsert>();
  readings = new Map<string, DamReadingInsert>();
  damUpsertCalls: DamInsert[][] = [];
  readingUpsertCalls: DamReadingInsert[][] = [];
  /** Make the next upsertReadings call throw once (simulates DB failure). */
  failNextReadingsUpsert = false;
  /** Row fixtures served by the read methods. */
  damRows: DamRow[] = [];
  readingRows: DamReadingRow[] = [];
  latestReadingRows: LatestDamReadingRow[] = [];

  async upsertDams(rows: DamInsert[]): Promise<void> {
    this.damUpsertCalls.push(rows);
    for (const row of rows) this.dams.set(row.id, row);
  }

  async upsertReadings(rows: DamReadingInsert[]): Promise<number> {
    if (this.failNextReadingsUpsert) {
      this.failNextReadingsUpsert = false;
      throw new RepositoryError("Injected readings upsert failure");
    }
    this.readingUpsertCalls.push(rows);
    for (const row of rows) {
      // Keyed exactly like the migration's unique constraint.
      this.readings.set(`${row.dam_id}|${row.observed_at}`, row);
    }
    return rows.length;
  }

  async listDams(): Promise<DamRow[]> {
    return [...this.damRows].sort((a, b) => a.name.localeCompare(b.name));
  }

  async getDam(id: string): Promise<DamRow | null> {
    return this.damRows.find((dam) => dam.id === id) ?? null;
  }

  async listLatestReadings(): Promise<LatestDamReadingRow[]> {
    return [...this.latestReadingRows];
  }

  async listRecentReadings(
    damId: string,
    limit: number,
  ): Promise<DamReadingRow[]> {
    return this.readingRows
      .filter((row) => row.dam_id === damId)
      .sort((a, b) => b.observed_at.localeCompare(a.observed_at))
      .slice(0, limit);
  }
}

export class FakeSyncRunsRepository implements SyncRunsRepository {
  runs: SyncRunRow[] = [];
  private nextId = 1;

  async createRun(kind: string, mode: SyncRunMode): Promise<SyncRunRow> {
    const running = this.runs.find((r) => r.kind === kind && r.status === "running");
    if (running) throw new SyncAlreadyRunningError(kind);
    const run: SyncRunRow = {
      id: this.nextId++,
      kind,
      mode,
      status: "running",
      started_at: new Date().toISOString(),
      finished_at: null,
      pages_fetched: 0,
      items_upserted: 0,
      last_cursor: null,
      error: null,
      created_at: new Date().toISOString(),
    };
    this.runs.push(run);
    return run;
  }

  async finishRun(id: number, patch: SyncRunFinish): Promise<void> {
    const run = this.runs.find((r) => r.id === id);
    if (!run) throw new RepositoryError(`Unknown sync run ${id}`);
    Object.assign(run, patch);
  }

  async saveProgress(
    id: number,
    progress: { pagesFetched: number; itemsUpserted: number; lastCursor: Record<string, string> | null },
  ): Promise<void> {
    const run = this.runs.find((r) => r.id === id);
    if (!run) throw new RepositoryError(`Unknown sync run ${id}`);
    run.pages_fetched = progress.pagesFetched;
    run.items_upserted = progress.itemsUpserted;
    run.last_cursor = progress.lastCursor;
  }

  async getLatestRun(kind: string, mode: SyncRunMode): Promise<SyncRunRow | null> {
    const matches = this.runs.filter((r) => r.kind === kind && r.mode === mode);
    return matches.length > 0 ? matches[matches.length - 1] : null;
  }

  async getLatestSuccessfulRun(kind: string): Promise<SyncRunRow | null> {
    const matches = this.runs.filter(
      (r) => r.kind === kind && r.status === "succeeded",
    );
    return matches.length > 0 ? matches[matches.length - 1] : null;
  }
}
