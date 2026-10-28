import type { AppSupabaseClient } from "@/lib/supabase/server";
import { RepositoryError } from "@/features/dams/repositories/errors";
import type {
  DamInsert,
  DamReadingInsert,
  DamReadingRow,
  DamRow,
  LatestDamReadingRow,
} from "@/types/database";

export interface DamsRepository {
  /** Upsert dam metadata, keyed by the API's own `id` — never creates duplicates. */
  upsertDams(rows: DamInsert[]): Promise<void>;
  /**
   * Upsert readings, keyed by (dam_id, observed_at) — the stable uniqueness
   * constraint from the migration. Returns the number of rows attempted.
   */
  upsertReadings(rows: DamReadingInsert[]): Promise<number>;
  /** All dams, ordered by name. */
  listDams(): Promise<DamRow[]>;
  /** A single dam by its API id, or null when unknown. */
  getDam(id: string): Promise<DamRow | null>;
  /** The newest reading per dam, via the `latest_dam_readings` view. */
  listLatestReadings(): Promise<LatestDamReadingRow[]>;
  /** A dam's most recent readings, newest first. */
  listRecentReadings(damId: string, limit: number): Promise<DamReadingRow[]>;
}

// Explicit column lists keep the read shape pinned to the migration; results
// are narrowed to the row types (select() is effectively untyped here).
const DAM_COLUMNS = "id, name, thresholds, created_at, updated_at";
const READING_COLUMNS =
  "dam_id, observed_at, level_m, rule_curve_m, normal_high_m, change_24h_m, source";

export function createDamsRepository(supabase: AppSupabaseClient): DamsRepository {
  return {
    async upsertDams(rows) {
      if (rows.length === 0) return;
      const { error } = await supabase.from("dams").upsert(rows, {
        onConflict: "id",
      });
      if (error) {
        throw new RepositoryError("Failed to upsert dams", { cause: error });
      }
    },

    async upsertReadings(rows) {
      if (rows.length === 0) return 0;
      const { error } = await supabase.from("dam_readings").upsert(rows, {
        onConflict: "dam_id,observed_at",
      });
      if (error) {
        throw new RepositoryError("Failed to upsert dam readings", { cause: error });
      }
      return rows.length;
    },

    async listDams() {
      const { data, error } = await supabase
        .from("dams")
        .select(DAM_COLUMNS)
        .order("name", { ascending: true });
      if (error) {
        throw new RepositoryError("Failed to list dams", { cause: error });
      }
      return data as DamRow[];
    },

    async getDam(id) {
      const { data, error } = await supabase
        .from("dams")
        .select(DAM_COLUMNS)
        .eq("id", id)
        .maybeSingle();
      if (error) {
        throw new RepositoryError(`Failed to read dam '${id}'`, { cause: error });
      }
      return data ? (data as DamRow) : null;
    },

    async listLatestReadings() {
      const { data, error } = await supabase
        .from("latest_dam_readings")
        .select(READING_COLUMNS);
      if (error) {
        throw new RepositoryError("Failed to list latest dam readings", {
          cause: error,
        });
      }
      return data as LatestDamReadingRow[];
    },

    async listRecentReadings(damId, limit) {
      const { data, error } = await supabase
        .from("dam_readings")
        .select(READING_COLUMNS)
        .eq("dam_id", damId)
        .order("observed_at", { ascending: false })
        .limit(limit);
      if (error) {
        throw new RepositoryError(
          `Failed to list readings for dam '${damId}'`,
          { cause: error },
        );
      }
      return data as DamReadingRow[];
    },
  };
}
