# Architecture Rules

The authoritative directory map lives in `docs/FILE_STRUCTURE.md`. This file defines the layering and dependency rules that structure exists to enforce.

## Layering (outer to inner)

```
app/ (route handlers, pages)      → may import features/, lib/, types/
features/<domain>/                → may import lib/, types/ (and its own submodules)
lib/ (framework-free utilities, external API clients) → may import types/
types/                            → imports nothing
```

- Route handlers are thin: parse/validate input, call a service, map the result to an HTTP response. No business logic in route files.
- Services orchestrate work (e.g., a synchronization run) and never construct SQL or fetch URLs directly.
- Repositories are the only code that issues Supabase queries. They accept a Supabase client (or client factory) so they can be tested without network access.
- External API clients (`lib/tubig/`) are the only code that performs outbound HTTP to the Tubig API. They return validated, typed data; they never persist anything.

## Feature Modules

Domain code lives under `features/<domain>/` with a consistent internal layout:

```
features/<domain>/
├── services/     # orchestration (sync runs, derived data)
├── repositories/ # Supabase queries
├── schemas/      # zod schemas for this domain's inputs/outputs (when non-trivial)
└── index.ts      # public exports; other modules import only from here
```

Cross-domain imports go through `features/<domain>/index.ts`, never deep-file imports.

## Supabase Access Patterns

- One server-side client factory (`lib/supabase/server.ts`), created per request/operation. Never a module-level singleton holding mutable state.
- Browser-visible pages use the publishable (anon) key; server-side sync writes use the secret key via a distinct factory.
- All queries belong in repositories; `onConflict` targets must match the migration's unique constraints.

## Synchronization Architecture

- A sync run is: create run record → fetch upstream (paginated, rate-limited) → upsert via repository → finalize run record with outcome.
- Sync state and history live in the `sync_runs` table — resumability and observability come from there, not from in-memory state.
- Concurrent runs are prevented by an explicit lock check before starting; a running run causes a no-op (or queued retry), not a parallel second run.
- Schedule via Vercel Cron hitting an authenticated route; manual refresh reuses the same service with stricter authorization.

## File Placement Conventions

| Adding... | Put it in |
| --- | --- |
| A page or route handler | `app/` |
| Domain business logic | `features/<domain>/` |
| An external API client | `lib/<api-name>/` |
| A framework-free utility with no domain meaning | `lib/` |
| A zod schema used at a boundary | `features/<domain>/schemas/` or `lib/<api-name>/schemas.ts` |
| Shared TS types | `types/` |
| A DB schema change | `supabase/migrations/` (never by editing old migrations) |
| A test | `tests/unit/` or `tests/integration/`, mirroring the source path |

Anything not on this list: propose a placement before creating it, and update `docs/FILE_STRUCTURE.md` when the structure changes.
