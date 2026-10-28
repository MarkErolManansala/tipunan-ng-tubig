# Testing Rules

## Framework and Commands

- **Vitest** (`tests/unit/`, `tests/integration/`).
- Verification commands (from `package.json`):

| Command | Purpose |
| --- | --- |
| `pnpm lint` | ESLint |
| `pnpm type-check` | `tsc --noEmit` |
| `pnpm test` | Vitest (all tests) |

Run lint + type-check after any code change, plus tests when touching sync, repositories, API clients, or schema-dependent code.

## Test Structure

```
tests/
├── unit/         # pure logic: pagination loops, rate-limit pacing, parsers, mappers
└── integration/  # services + repositories against a mock/in-memory Supabase client
```

- Mirror source paths in test file names (e.g., `tests/unit/lib/tubig/http.test.ts`).
- No test may hit the real Tubig API or a real database. Tests are deterministic and offline.

## Mocking the Upstream Tubig API

- Mock at the HTTP client seam (inject a `fetch`-like function or a fake transport into the Tubig client factory).
- Fixtures represent real API response shapes: `{ items, next, sources }`, dam-specific `thresholds` keys, nullable reading fields.

## Required Coverage for Synchronization

Every sync behavior below needs at least one test:

- **Pagination:** multiple pages traversed by passing back the returned `next` cursor until it is `null`; the cursor is passed through unmodified.
- **Rate limits:** `429` responses honor `Retry-After` (test the computed delay, not wall-clock waiting); the request budget (5 calls/min) is respected.
- **Retries/timeouts:** bounded retries on transient failure; timeout aborts a hung request.
- **Upserts/deduplication:** running the sync twice against the same data results in no duplicate readings (unique `(dam_id, observed_at)` upsert).
- **Missing/nullable data:** dams with empty `thresholds`, `latest: null`, and nullable reading fields persist correctly and are not coerced to zero.
- **Partial failure:** a failure mid-run marks the run as failed in `sync_runs` with the error, and a re-run completes without duplicating already-persisted pages.
- **Upstream outages:** 404 for an unknown dam id, 422 for bad params, network errors — all end in typed failures, not crashes.
- **Date handling:** Manila-date filters (`YYYY-MM-DD`) are passed through as calendar dates; stored timestamps remain UTC.

## Database Test Isolation

- Repository tests use an in-memory/mocked Supabase client; they assert on the calls made (table, conflict target, payload shape), not on a live database.
- No integration test requires a running Supabase stack. If true DB integration tests are added later, they must run against a disposable local database (`supabase db reset`) and be isolated per test.

## What Not to Test

- Generated or trivial glue (plain re-exports, type-only files).
- Next.js framework behavior itself (e.g., that `Response.json` works).
