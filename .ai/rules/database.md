# Database Rules

## Core Decisions

1. **Database:** Supabase PostgreSQL (PG 17, per `supabase/config.toml`).
2. **Application client:** `@supabase/supabase-js` v2 — the only way application code touches the database.
3. **Schema source of truth:** SQL migrations in `supabase/migrations/` (applied via Supabase CLI). Seed data in `supabase/seed.sql`.

## Prohibited

- **Prisma is prohibited** — do not install it, do not add `prisma` or `@prisma/client` to `package.json`, do not create a `prisma/` directory, do not generate Prisma clients, and do not use Prisma-style migrations.
- The same prohibition applies to **any other ORM** (Drizzle, TypeORM, Sequelize, MikroORM, Knex as a query builder, etc.). Raw `pg`/`postgres` drivers are also not used from application code; everything goes through `@supabase/supabase-js`.

## Migrations

- Never edit an applied migration; add a new timestamped file. Migration files are idempotent-by-ordering, not individually re-runnable.
- Every table: `created_at timestamptz not null default now()`, RLS enabled in the same migration that creates the table.
- Indexes are added in migrations when a query pattern requires them (e.g., `(dam_id, observed_at desc)` for recent-readings lookups).

## Types

- Generate `Database` types where practical (Supabase CLI `gen types`) and commit them; repositories type their results against them. When generated types are not available for a table yet, define minimal local types in `types/` and mark them for regeneration.

## Uniqueness and Idempotent Upserts

- The stable uniqueness key for readings is `(dam_id, observed_at)` — verified against the API (one reading per dam per observation timestamp). Enforced with a unique constraint, not application-level checks.
- Upserts declare `onConflict` explicitly; the conflict target must match a real migration constraint. Do not rely on blind `upsert` without a target.
- Dam rows are keyed by the API's `id` (text PK) and updated in place — no duplicate dam rows across runs.

## Transactions and Multi-Step Operations

- `supabase-js` does not expose cross-statement transactions over the Data API. Multi-step consistency therefore comes from design:
  - Writes are structured so a crash mid-run leaves only *fewer* rows, not wrong rows (append-only readings + idempotent upserts).
  - Run state transitions in `sync_runs` are single-row updates.
  - If a true multi-table transaction becomes necessary, use a Postgres function (RPC) created in a migration — this is the approved escape hatch.

## Time and Precision

- Observation timestamps: `timestamptz` (UTC). The API's `from`/`to` filters are Manila calendar dates (`YYYY-MM-DD`) and must remain distinct from stored UTC instants.
- Water levels and thresholds: `numeric` (not float), nullable where the API returns `null`. `null` means unknown — never zero.

## Retention and Sync State

- `sync_runs` records each run (kind, status, counts, error) and carries resumability data (e.g., last successful cursor). Recent-run history is retained; prune old completed runs only if/when a retention requirement is demonstrated.
- Readings are retained indefinitely unless a retention policy is added in a future migration.
