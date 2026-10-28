# File Structure

Authoritative map of the repository. **Status markers: [E] exists · [P] planned (not yet created).** A planned item must never be described as implemented. Update this document in the same change whenever the structure changes.

Stack: Next.js 16 (App Router, root-level `app/`), React 19, TypeScript strict, Supabase PostgreSQL 17 via `@supabase/supabase-js`, zod, Tailwind v4, Vercel Cron, Vitest. **No ORM (Prisma prohibited).**

## Repository Layout

```text
tipunan-ng-tubig/
├── .ai/
│   └── rules/                          [E] Persistent project-wide AI rules
│       ├── project-overview.md         [E] Purpose, stack, status, non-negotiables
│       ├── architecture.md             [E] Layering, modules, dependency direction
│       ├── coding-standards.md         [E] TS/naming/error-handling/validation
│       ├── security.md                 [E] Secrets, RLS, cron auth, SSRF, logging
│       ├── database.md                 [E] Supabase-only access, migrations, upserts
│       └── testing.md                  [E] Vitest expectations and coverage
├── .agent/
│   └── skills/                         [E] Reusable agent workflows
│       ├── project-structure/SKILL.md  [E] Creating/moving files consistently
│       ├── tubig-api-sync/SKILL.md     [E] Implementing/maintaining sync
│       └── supabase-database/SKILL.md  [E] Schema, migrations, RLS, repositories
├── .env.example                        [E] Documented environment variables
├── AGENTS.md                           [E] Agent entry point (Next.js block + instruction system)
├── DESIGN.md                           [E] UI design system — required for UI work
├── docs/
│   └── FILE_STRUCTURE.md               [E] This document
├── app/                                [E] Next.js App Router (route handlers + pages)
│   ├── layout.tsx                      [E] Root layout (Geist Sans + Geist Mono, site header/footer)
│   ├── page.tsx                        [E] Home dashboard: navy hero (PPR shell) + streamed overview/attention/directory
│   ├── dams/[id]/page.tsx              [E] Dam detail: reading panel, chart, thresholds ladder, history
│   ├── error.tsx                       [E] Route-level error boundary (client)
│   ├── not-found.tsx                   [E] Unknown dam id page
│   ├── api/
│   │   └── cron/
│   │       └── sync-dams/route.ts      [E] Vercel Cron target, CRON_SECRET Bearer auth
│   └── globals.css                     [E] Tailwind v4 + DESIGN.md token mapping
├── lib/                                [E] Framework-free utilities and API clients
│   ├── env.ts                          [E] Server env access helpers (single process.env seam)
│   ├── supabase/server.ts              [E] Client factories (publishable-key / secret-key)
│   └── tubig/
│       ├── schemas.ts                  [E] zod schemas for verified API response shapes
│       ├── http.ts                     [E] Transport: pacing, timeout, retries, Retry-After; SSRF-safe `next` resolver
│       └── client.ts                   [E] Dam endpoints (list + readings), validated
├── features/                           [E] Domain modules
│   └── dams/
│       ├── index.ts                    [E] Public exports (other modules import only this)
│       ├── repositories/
│       │   ├── dams-repository.ts      [E] Upserts (dams on `id`, readings on `(dam_id, observed_at)`) + read queries
│       │   ├── sync-runs-repository.ts [E] Run creation/progress/finalization, latest-run + latest-successful-run lookup
│       │   └── errors.ts               [E] RepositoryError, SyncAlreadyRunningError
│       ├── services/
│       │   └── dams.ts                 [E] Read-side service: dam summaries (incl. thresholds)/detail (incl. updatedAt)/freshness view models
│       └── sync/
│           └── sync-dams.ts            [E] Sync orchestration (routine + resumable backfill)
├── types/
│   ├── database.ts                     [E] Row/view shapes + thresholds narrowing derived from generated types
│   └── database.types.ts               [E] Generated Supabase types (view entry hand-mirrored until regeneration)
├── components/                           [E] Shared React components (server by default)
│   ├── site-header.tsx                   [E] DESIGN.md navy chrome (wordmark + section link)
│   ├── site-footer.tsx                   [E] DESIGN.md footer band (attribution + status disclosure)
│   ├── ui/                               [E] shadcn primitives (button, card, chart, input, select, badge, table, skeleton, tooltip)
│   └── dams/
│       ├── status.ts                     [E] Application-defined status derivation (pure, unit-tested)
│       ├── format.ts                     [E] Metre/PHT/age formatting + staleness rule
│       ├── contour-field.tsx             [E] Decorative topographic contour SVG (aria-hidden)
│       ├── dam-status-badge.tsx          [E] DamStatusBadge + FreshnessChip chips
│       ├── threshold-indicator.tsx       [E] ThresholdIndicator ladder + MiniLevelBar (inline SVG)
│       ├── water-level-chart.tsx         [E] WaterLevelChart on shadcn chart/recharts (client)
│       ├── dam-directory.tsx             [E] Directory: search/filter/sort; table + mobile cards (client)
│       └── dam-readings-table.tsx        [E] Dam readings history table
├── supabase/                           [E] Supabase CLI project
│   ├── config.toml                     [E] Local stack config (PG 17)
│   ├── migrations/
│   │   ├── 20261028120000_init_dams.sql [E] dams, dam_readings, sync_runs, RLS, run-lock index
│   │   └── 20261028130000_latest_dam_readings.sql [E] latest-reading-per-dam view (security_invoker)
│   └── seed.sql                        [E] Seed stub (data arrives via sync, not seeds)
├── tests/
│   ├── helpers/                        [E] Shared fixtures + fakes (tubig fixtures, fake clients/repos)
│   ├── unit/                           [E] Transport pacing/retries/SSRF, client validation, dams service tests, status/format logic
│   └── integration/                    [E] Sync orchestration + repository protocol tests
├── vitest.config.mts                   [E] Vitest config (`@` alias, node environment)
├── eslint.config.mjs                   [E] ESLint (next core-web-vitals + TS)
├── next.config.ts                      [E] cacheComponents, Tailwind via Turbopack
├── vercel.json                         [E] Cron schedule: daily 03:00 UTC sync-dams
├── package.json                        [E] Scripts: dev/build/start/lint/type-check/test
├── tsconfig.json                       [E] Strict; alias @/* → repo root
└── .idea/, .next/, node_modules/, public/  [E] Tooling/build/IDE artifacts
```

## Instruction-System Relationships

```text
AGENTS.md (entry point: tells agents what to read)
  ├── docs/FILE_STRUCTURE.md   ← read before structural changes; kept in sync with reality
  ├── .ai/rules/*.md           ← stable constraints (what must always be true)
  └── .agent/skills/*/SKILL.md ← repeatable workflows (how to do a task class)
DESIGN.md                      ← UI work must follow it (referenced from AGENTS.md)
```

Rules stay short by referencing shared sources: `architecture.md` references this document instead of duplicating the tree; skills reference rules instead of restating constraints.

## Module Responsibilities

| Module | Responsibility |
| --- | --- |
| `app/` | HTTP surface only: parse/validate input, call a feature service, map result to response. No business logic. |
| `lib/tubig/` | The only code performing outbound HTTP to the Tubig API. Validates responses with zod, handles timeouts/retries/`Retry-After`/pacing. Never persists. |
| `lib/supabase/` | Client factories: anon-key client for public reads; secret-key client for server-side sync writes only. |
| `features/dams/` | Dam domain: sync orchestration, Supabase repositories, services. Cross-domain imports go through `features/dams/index.ts`. |
| `supabase/migrations/` | Schema truth. Append-only, timestamped. RLS enabled per table at creation. |
| `types/` | Shared types (incl. generated DB types when produced). |
| `tests/` | Vitest unit + integration tests; offline, deterministic, mirror source paths. |

## Data Flows

### Read flow (implemented in code; needs a deployed database to serve data)

```
RSC page (app/page.tsx, app/dams/[id]/page.tsx)
   → await connection() + <Suspense>: the read is request-time only, the shell prerenders
   → createPublicDamsService (features/dams/services/dams.ts)
   → features/dams repositories (supabase-js, publishable-key client)
       latest reading per dam comes from the latest_dam_readings view
   → Supabase (RLS: anon select)
```

With `cacheComponents` enabled, pages must not read data during prerendering:
each page wraps its data component in `<Suspense>` and the component awaits
`connection()` before touching Supabase. Once a database is linked, the reads
can move into `use cache` with a `cacheLife` profile instead.

### Synchronization flow (implemented in code; needs a deployed database + CRON_SECRET to run)

```
Vercel Cron daily 03:00 UTC (Authorization: Bearer CRON_SECRET)
  → app/api/cron/sync-dams (route.ts; fails closed without CRON_SECRET)
  → features/dams syncDams (sync/sync-dams.ts)
      1. Load resumable cursors from the latest backfill run (before creating this run's row)
      2. Create sync_runs row — the partial unique index rejects a concurrent run (409)
      3. lib/tubig: GET /v1/history/dams (pacing ≤5 calls/min, timeout, bounded retries)
      4. Upsert dams (conflict: id; thresholds jsonb verbatim)
      5. Upsert latest readings (conflict: (dam_id, observed_at))
      6. Historical readings per dam:
           routine  → newest page only
           backfill → walk pages until next=null (capped per run),
                      persisting per-dam cursors via saveProgress after each dam
      7. Finalize sync_runs (status, pages, upserts, error, last_cursor)
  → Supabase (secret-key client, bypasses RLS)
```

Failure at any step finalizes the run as failed with the error text; a later run resumes idempotently — upserts make re-persisted pages harmless.

## Planned vs Implemented

Implemented: the rule system (`AGENTS.md`, `.ai/rules/`, `.agent/skills/`, this document, `.env.example`), the database migrations (init + latest-readings view, applied to the hosted project via `supabase db push`), the Tubig client, the dam sync (routine + resumable backfill), the cron route, the read-side service and repositories, the redesigned public UI (navy-chrome identity per DESIGN.md v2: home dashboard with attention ranking + searchable/filterable directory, dam detail with recharts water-level chart, threshold ladder, and history table, error/not-found states), `vercel.json`, and the test suite (78 tests). `types/database.types.ts` contains generated types with the view entry hand-mirrored — regenerate with `supabase gen types typescript --linked` now that the project is linked.

Planned: any further Tubig datasets, and optionally `use cache` on the read paths once a database exists.

## Where Future Features Go

A new Tubig dataset (e.g., rivers) gets: `lib/tubig/` endpoint definitions, `features/<domain>/` with repositories + sync, its own migration, a cron route, and tests — following `tubig-api-sync`. New UI surfaces follow `DESIGN.md` and the placement table in `.ai/rules/architecture.md`.

## Updating This Document

1. Change the code first; then update this document in the same change set.
2. Flip [P] → [E] when an item is created; add new directories/files with one-line purposes.
3. Keep the data-flow diagrams accurate when sync behavior changes.
4. Do not describe removed code or aspirational structure as current.
