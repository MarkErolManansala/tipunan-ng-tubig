/** Domain-specific errors for the dams feature. */

/** A Supabase query failed. Carries the Supabase error as `cause`. */
export class RepositoryError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RepositoryError";
  }
}

/**
 * A sync run could not start because another run of the same kind is still
 * running. Detected via the `sync_runs_one_running_per_kind` partial unique
 * index (Postgres error 23505) — see the initial migration.
 */
export class SyncAlreadyRunningError extends Error {
  readonly kind: string;

  constructor(kind: string) {
    super(`A '${kind}' synchronization run is already running`);
    this.name = "SyncAlreadyRunningError";
    this.kind = kind;
  }
}
