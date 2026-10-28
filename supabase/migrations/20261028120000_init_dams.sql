-- Initial dam schema for the Tubig API data mirror.
--
-- Data contract (verified against https://tubig-api.rjhon.net/v1/history/dams on 2026-10-28):
-- - Dams are keyed by the API's own `id` slug (e.g. `angat`, `la_mesa`).
-- - `thresholds` keys vary per dam and may be an empty object; stored verbatim as JSONB.
-- - Readings are unique per (dam_id, observed_at) — one observation timestamp per dam.
--   This is the idempotent-upsert conflict target; never weaken it to re-key deduplication.
-- - Measurement columns are nullable: NULL means unknown, not zero.
--
-- Rollback note: reverting drops dam data (recoverable by re-running a sync).
-- Re-run the sync after any restore to repopulate.

-- ── dams ─────────────────────────────────────────────────────────────────────
create table public.dams (
  id text primary key,
  name text not null,
  thresholds jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── dam_readings ─────────────────────────────────────────────────────────────
create table public.dam_readings (
  id bigint generated always as identity primary key,
  dam_id text not null references public.dams (id) on delete cascade,
  observed_at timestamptz not null,
  level_m numeric,
  rule_curve_m numeric,
  normal_high_m numeric,
  change_24h_m numeric,
  source text,
  created_at timestamptz not null default now()
);

-- Idempotency key for sync upserts.
alter table public.dam_readings
  add constraint dam_readings_dam_observed_unique unique (dam_id, observed_at);

-- Recent-readings lookups (newest first per dam).
create index dam_readings_dam_recent_idx
  on public.dam_readings (dam_id, observed_at desc);

-- ── sync_runs ────────────────────────────────────────────────────────────────
create table public.sync_runs (
  id bigint generated always as identity primary key,
  kind text not null,
  mode text not null default 'routine'
    check (mode in ('routine', 'backfill')),
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  pages_fetched integer not null default 0,
  items_upserted integer not null default 0,
  last_cursor jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index sync_runs_kind_started_idx
  on public.sync_runs (kind, started_at desc);

-- Database-level lock: only one running run per kind. Repositories rely on the
-- 23505 unique-violation from this index to detect a concurrent run.
create unique index sync_runs_one_running_per_kind
  on public.sync_runs (kind) where status = 'running';

-- ── Row Level Security ───────────────────────────────────────────────────────
-- All tables: anon/authenticated may read; no writes are granted to them.
-- Sync writes run under the server's secret key, which bypasses RLS.

alter table public.dams enable row level security;
alter table public.dam_readings enable row level security;
alter table public.sync_runs enable row level security;

create policy "Public read access to dams"
  on public.dams for select to anon, authenticated using (true);

create policy "Public read access to dam readings"
  on public.dam_readings for select to anon, authenticated using (true);

create policy "Public read access to sync runs"
  on public.sync_runs for select to anon, authenticated using (true);
