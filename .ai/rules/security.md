# Security Rules

## Server-Only Secrets

- `SUPABASE_SECRET_KEY` (service-role equivalent) and `CRON_SECRET` must never be read in client code or prefixed with `NEXT_PUBLIC_`.
- Server clients using the secret key are created only inside server-side code paths (route handlers, sync services) and never passed into props or client components.
- `.env.local` is git-ignored; `.env.example` documents every variable without real values.

## Supabase Row Level Security

- RLS is enabled on every table in the first migration that creates it. A table without RLS is a defect.
- Public-facing data (`dams`, `dam_readings`, read-only parts of `sync_runs`) allows `select` to `anon`; writes are never granted to `anon`/`authenticated` — sync writes run under the server's secret key, which bypasses RLS.
- No per-user data exists yet; if user accounts are ever added, tighten `select` policies at that time.

## Authorization

- Cron endpoint (`/api/cron/sync-dams`): requires `Authorization: Bearer <CRON_SECRET>`; reject otherwise with `401`. Vercel Cron sends this header automatically when `CRON_SECRET` is set.
- Manual sync trigger (if built): authenticated admin only, never public. Do not build one without an explicit authorization mechanism.
- Read APIs for dam data are public read-only; reject all mutations with `405`.

## Input Validation

- Every route handler validates its inputs (query params, body) with zod before use.
- Readings query params: `limit` clamped to 1–500, `cursor` is opaque (string passthrough, length-capped), `from`/`to` match `YYYY-MM-DD`.

## Server-Side Request Forgery (SSRF)

- Outbound requests go only to the configured `TUBIG_API_BASE_URL`. Never build a request URL from user-supplied text except the opaque `cursor`, which is passed as a URL query parameter on the pinned base URL, and the dam `id`, which must match the API's own slug pattern (`[a-z0-9_]+`) before being embedded in a path.
- Never fetch a URL supplied by a client or by the upstream response body itself.

## Logging

- Log method + outcome + counts (e.g., "dams sync finished: 9 upserted"), never credentials, full upstream payloads, or tokens.
- Errors returned to clients contain a stable message and no stack traces or internal identifiers beyond what is needed.

## Exposure Restrictions

- Do not expose internal error details, database error messages, or the upstream API's raw error bodies in HTTP responses.
- Data returned to clients passes through the same zod schemas used for ingestion, so unknown upstream fields do not leak into responses.
