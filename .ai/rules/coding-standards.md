# Coding Standards

The project is TypeScript strict (`tsconfig.json`), linted with ESLint (`eslint-config-next` + core-web-vitals). Verify with the commands in `.ai/rules/testing.md`.

## TypeScript

- Strict mode is on; do not loosen it per-file or add `@ts-ignore`. Use targeted `@ts-expect-error` with a reason comment only when unavoidable.
- No `any`. Use `unknown` at boundaries and narrow with zod or type guards.
- Derive types from zod schemas (`z.infer<...>`) at API/validation boundaries rather than hand-writing duplicates.
- Prefer `readonly` inputs and pure functions in `lib/`.

## Naming

- Files/directories: `kebab-case`. React components and TS types: `PascalCase`. Everything else: `camelCase` (constants that are true constants may use `SCREAMING_SNAKE_CASE`).
- Environment variables: documented in `.env.example`; server-only ones must not start with `NEXT_PUBLIC_`.
- Booleans read as predicates (`isRunning`, `hasNext`).
- Repository methods use data-vocabulary verbs: `list`, `get`, `upsert`, `insert`.

## Component Organization

- `app/` holds route files only; shared UI lives in `components/`.
- Server Components by default; add `"use client"` only when interactivity requires it.
- UI must follow `DESIGN.md` (colors, typography, spacing, components).

## Error Handling

- Expected failures (upstream 4xx/5xx, validation, rate limits) are modeled values, not exceptions: return a typed result (`{ ok: true, data }` / `{ ok: false, error }`) or a domain error type.
- Only truly unexpected failures may throw; when they do, let them propagate to the route handler, which maps to a 5xx without leaking internals.
- Never swallow errors silently. Sync errors are recorded in `sync_runs.error`.
- Route handlers must not return raw upstream error bodies or stack traces to clients.

## Validation

- Validate at every boundary: route handler inputs, external API responses, environment variables.
- Env validation happens in one place per concern (e.g., `lib/env.ts` style helpers), not scattered `process.env` reads with ad-hoc assumptions. `process.env` may be read directly only in client factories/env modules.
- Nullable API fields are typed as `| null`, never defaulted to zero or empty strings.

## Imports and Dependency Boundaries

- Use the `@/` alias for absolute imports within the repo.
- Respect the layering rules in `.ai/rules/architecture.md`: no `features/` importing from `app/`; no `lib/` importing from `features/`.
- No deep imports across feature modules (go through `features/<domain>/index.ts`).

## Avoid Unnecessary Abstraction

- Do not create an interface/class for a single implementation "just in case". Extract when a second concrete use appears.
- Do not copy-paste similar sync/query logic across domains: extract into `lib/` only once the shared shape is confirmed by the second use.
- No utility files with one trivial function. Inline it.
