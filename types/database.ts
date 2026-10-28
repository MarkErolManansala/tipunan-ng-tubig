import type { Database, Json } from "@/types/database.types";

/**
 * Helper types derived from the generated Supabase database types
 * (`types/database.types.ts`, produced by `supabase gen types typescript
 * --linked`). Regenerate after every migration that changes the schema.
 *
 * See .ai/rules/database.md.
 */

type Tables = Database["public"]["Tables"];

/** Check-constraint enums (not encoded in the generated column types). */
export type SyncRunMode = "routine" | "backfill";
export type SyncRunStatus = "running" | "succeeded" | "failed";

/** Row shape of `dams`. */
export type DamRow = Tables["dams"]["Row"];

/** Row shape of `dam_readings`. */
export type DamReadingRow = Tables["dam_readings"]["Row"];

/** Row shape of the `latest_dam_readings` view (newest reading per dam). */
export type LatestDamReadingRow =
  Database["public"]["Views"]["latest_dam_readings"]["Row"];

/**
 * The `dams.thresholds` jsonb narrowed to a plain object at the read boundary.
 * The sync stores the API's thresholds verbatim; keys vary per dam and the
 * object may be empty. Non-object jsonb (should not occur) narrows to `{}`.
 */
export type DamThresholds = Record<string, Json>;

/** Insert/update payload for `dams` (conflict target: `id`). */
export type DamInsert = Tables["dams"]["Insert"];

/** Insert/update payload for `dam_readings` (conflict: dam_id + observed_at). */
export type DamReadingInsert = Tables["dam_readings"]["Insert"];

/**
 * Row shape of `sync_runs`, with the check-constraint unions and the parsed
 * per-dam pagination cursors (jsonb → Record) narrowed at the boundary.
 */
export type SyncRunRow = Omit<
  Tables["sync_runs"]["Row"],
  "mode" | "status" | "last_cursor" | "created_at"
> & {
  mode: SyncRunMode;
  status: SyncRunStatus;
  last_cursor: Record<string, string> | null;
  created_at: string;
};

export type SyncRunInsert = Tables["sync_runs"]["Insert"];

/** Finalization payload for `sync_runs` (status + resumability data). */
export type SyncRunFinish = Omit<
  Tables["sync_runs"]["Update"],
  "status" | "last_cursor"
> & {
  status: Exclude<SyncRunStatus, "running">;
  last_cursor: Record<string, string> | null;
};
