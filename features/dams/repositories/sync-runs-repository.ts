import type { AppSupabaseClient } from "@/lib/supabase/server";
import {
  RepositoryError,
  SyncAlreadyRunningError,
} from "@/features/dams/repositories/errors";
import type {
  SyncRunFinish,
  SyncRunInsert,
  SyncRunMode,
  SyncRunRow,
} from "@/types/database";

export interface SyncRunsRepository {
  /**
   * Create a run row. Throws `SyncAlreadyRunningError` when a run of the same
   * kind is still running (enforced by the database's partial unique index,
   * which also makes the check safe across concurrent workers).
   */
  createRun(kind: string, mode: SyncRunMode): Promise<SyncRunRow>;
  /** Finalize a run with its outcome and resumability data. */
  finishRun(id: number, patch: SyncRunFinish): Promise<void>;
  /** Persist mid-run progress so an interrupted run can be resumed. */
  saveProgress(
    id: number,
    progress: { pagesFetched: number; itemsUpserted: number; lastCursor: Record<string, string> | null },
  ): Promise<void>;
  /** Most recent run for kind+mode, or null. Used to resume interrupted backfills. */
  getLatestRun(kind: string, mode: SyncRunMode): Promise<SyncRunRow | null>;
  /** Most recent succeeded run for a kind, regardless of mode. Or null. */
  getLatestSuccessfulRun(kind: string): Promise<SyncRunRow | null>;
}

// The literal column list is still required because select() is untyped here;
// results are narrowed to SyncRunRow (check-constraint unions + parsed cursors).
const SELECT_COLUMNS =
  "id, kind, mode, status, started_at, finished_at, pages_fetched, items_upserted, last_cursor, error";

export function createSyncRunsRepository(
  supabase: AppSupabaseClient,
): SyncRunsRepository {
  return {
    async createRun(kind: string, mode: SyncRunMode): Promise<SyncRunRow> {
      const { data, error } = await supabase
        .from("sync_runs")
        .insert({ kind, mode } satisfies SyncRunInsert)
        .select(SELECT_COLUMNS)
        .single();
      if (error) {
        if (error.code === "23505") {
          throw new SyncAlreadyRunningError(kind);
        }
        throw new RepositoryError("Failed to create sync run", { cause: error });
      }
      return data as SyncRunRow;
    },

    async finishRun(id: number, patch: SyncRunFinish): Promise<void> {
      const { error } = await supabase
        .from("sync_runs")
        .update(patch)
        .eq("id", id);
      if (error) {
        throw new RepositoryError("Failed to finalize sync run", { cause: error });
      }
    },

    async saveProgress(id, progress): Promise<void> {
      const { error } = await supabase
        .from("sync_runs")
        .update({
          pages_fetched: progress.pagesFetched,
          items_upserted: progress.itemsUpserted,
          last_cursor: progress.lastCursor,
        })
        .eq("id", id);
      if (error) {
        throw new RepositoryError("Failed to save sync progress", { cause: error });
      }
    },

    async getLatestRun(kind, mode): Promise<SyncRunRow | null> {
      const { data, error } = await supabase
        .from("sync_runs")
        .select(SELECT_COLUMNS)
        .eq("kind", kind)
        .eq("mode", mode)
        .order("started_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        throw new RepositoryError("Failed to read latest sync run", { cause: error });
      }
      return data ? (data as SyncRunRow) : null;
    },

    async getLatestSuccessfulRun(kind): Promise<SyncRunRow | null> {
      const { data, error } = await supabase
        .from("sync_runs")
        .select(SELECT_COLUMNS)
        .eq("kind", kind)
        .eq("status", "succeeded")
        .order("started_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        throw new RepositoryError("Failed to read latest successful sync run", {
          cause: error,
        });
      }
      return data ? (data as SyncRunRow) : null;
    },
  };
}
