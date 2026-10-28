# Skill: Tubig API Synchronization

## When to Use

Use this skill when implementing or modifying synchronization of any Tubig API dataset — dam data today, rivers/rain gauges/interruptions later — or when changing the cron route, rate-limit handling, or pagination logic.

## Upstream Facts (verified 2026-10-28)

- Base: `https://tubig-api.rjhon.net` (no key, plain GET, CORS-open).
- Dam endpoints:
  - `GET /v1/history/dams` → `{ items, next, sources }`; each dam: `{ id, name, thresholds, latest }`. `thresholds` is an object whose keys vary per dam (e.g., `critical`, `spilling`, `maintaining`, `minimum_operating`, `normal_high` — or empty). `latest` may be `null` and its fields (`observed_at`, `level_m`, `rule_curve_m`, `normal_high_m`, `change_24h_m`, `source`) may individually be `null`.
  - `GET /v1/history/dams/{dam}/readings?limit=&cursor=&from=&to=` → `{ items, next, sources }`; reading fields as above. `limit` 1–500 (default 100); `from`/`to` are Manila calendar dates `YYYY-MM-DD`.
- Limits: **5 calls/minute**, 500 items/call; `429` carries `Retry-After` (seconds). Dams upstream refresh ~once a day.
- Sources array (e.g., PAGASA dam information) must be preserved and shown wherever data is displayed: https://pagasa.dost.gov.ph/flood

**Before relying on any field shape not listed here, fetch the endpoint and verify. Do not invent fields, IDs, or cursors.**

## Steps

1. **Read** `.ai/rules/architecture.md`, `.ai/rules/database.md`, `.ai/rules/security.md`, `.ai/rules/testing.md`, and `.agent/skills/supabase-database/SKILL.md`.
2. **Verify the API contract** against `docs/FILE_STRUCTURE.md`'s data-flow section and, if anything seems changed, against a live `curl` of the endpoint.
3. **Client work** happens only in `lib/tubig/`:
   - zod schemas validate every response before it leaves the client.
   - `limit` clamped 1–500; `cursor` passed through opaque; `dam` id validated against `[a-z0-9_]+` before path embedding.
   - One transport layer: request timeouts, bounded retries for transient errors, `429` → wait per `Retry-After`, and a request-pacing budget of ≤5 calls/minute.
4. **Sync service work** happens only in `features/dams/sync/` (or the domain's equivalent):
   - One run = create `sync_runs` row → fetch → upsert via repository → finalize row (status, counts, error, last cursor for resumability).
   - Guard against concurrent runs with a lock check; a busy run yields a no-op, not a parallel run.
   - Upserts use the real unique constraint: readings conflict on `(dam_id, observed_at)`; dam metadata keyed by API `id`.
   - Incremental: historical backfill resumes from the last cursor; routine runs only fetch what is needed.
5. **Route work** in `app/api/cron/sync-dams/route.ts`: validate `Authorization: Bearer <CRON_SECRET>`; return `401` otherwise; schedule in `vercel.json`.
6. **Persist attribution**: keep `sources` in the DB or read it from the dam-list sync so the UI can render attribution.
7. **Tests** (per `.ai/rules/testing.md`): pagination traversal, 429/Retry-After, retry/timeout, double-run dedup, partial failure recovery, nullable fields, date handling, upstream outage handling.
8. **Verify:** `pnpm lint`, `pnpm type-check`, `pnpm test`.

## Constraints

- Never request more data than the strategy needs (avoid needless repeated calls; upstream is rate-limited for everyone).
- `null` stays `null` — unknown, not zero.
- External API code never imports repositories; sync service composes them.

## Verification

- [ ] All responses validated by zod before use
- [ ] Rate budget and `Retry-After` honored; cursor opaque
- [ ] Double-run produces no duplicate readings (test proves it)
- [ ] `sync_runs` records outcome and error text for failures
- [ ] Cron endpoint rejects unauthenticated calls
- [ ] Lint, type-check, tests pass
