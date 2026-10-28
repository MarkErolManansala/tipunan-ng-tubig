# Project Overview — Tipunan ng Tubig

## Purpose

A data mirror for the [Tubig API](https://tubig-api.rjhon.net/history/api): it periodically synchronizes Philippine dam information and historical water-level readings (PAGASA-sourced) into a Supabase PostgreSQL database and serves them to the application UI. Future datasets from the same API (rivers, rain gauges, interruptions, drought) can be added following the same pattern.

## Technology Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, root-level `app/` directory) |
| UI | React 19, Tailwind CSS v4 (Turbopack) |
| Language | TypeScript (strict) |
| Database | Supabase PostgreSQL (PG 17) |
| DB client | `@supabase/supabase-js` v2 |
| Validation | `zod` v4 |
| Scheduled jobs | Vercel Cron |
| Tests | Vitest |
| Package manager | pnpm |

## External Dependency: Tubig API

- Base URL: `https://tubig-api.rjhon.net` (configurable via `TUBIG_API_BASE_URL`).
- No API key required; plain `GET`; CORS-open; rate-limited to **5 calls/minute per visitor** and **500 items per call**.
- Dam endpoints:
  - `GET /v1/history/dams` — dam list with thresholds and latest reading.
  - `GET /v1/history/dams/{dam}/readings` — historical readings, paginated with an opaque cursor.
- Responses: `{ items, next, sources }`. `next` is an opaque cursor — pass it back as-is, never construct one.
- Errors: `404` unknown dam, `422` bad parameter, `429` over limit (with `Retry-After` seconds).
- Attribution required: PAGASA dam information — https://pagasa.dost.gov.ph/flood. Each response carries its own `sources` array; preserve and display it.

## Non-Negotiable Decisions

1. **No Prisma, no ORM.** Database access uses `@supabase/supabase-js` only. Schema changes use SQL migrations under `supabase/migrations/`.
2. **Root-level `app/` layout.** No `src/` directory. Alias `@/*` maps to the repo root.
3. **External API access is separate from database persistence.** The Tubig client never touches Supabase; repositories never call the network.
4. **Never fabricate data.** No invented dam IDs, threshold keys, cursors, readings, or timestamps. Nullable API fields stay nullable.
5. **Secrets are server-only.** The Supabase secret key and `CRON_SECRET` are never exposed to the client.

## Implementation Status

- [x] Scaffolded Next.js app (`app/layout.tsx`, `app/page.tsx`)
- [x] Supabase CLI project (`supabase/config.toml`)
- [x] Dam schema migration (`supabase/migrations/20261028120000_init_dams.sql`) — not yet applied to a live database
- [x] Tubig API client (`lib/tubig/`)
- [x] Dam sync service, routine + resumable backfill (`features/dams/`)
- [x] Cron route (`app/api/cron/sync-dams/route.ts`) + `vercel.json` schedule
- [x] Test suite (Vitest, 40 tests)
- [ ] Public read routes and UI
- [ ] Generated database types (`supabase gen types`)

## Related Documents

- `docs/FILE_STRUCTURE.md` — file placement and module responsibilities.
- `.ai/rules/architecture.md`, `.ai/rules/database.md`, `.ai/rules/security.md`, `.ai/rules/testing.md`, `.ai/rules/coding-standards.md`.
- `.agent/skills/` — reusable workflows.
- `DESIGN.md` — UI design system (required reading for any UI work).
