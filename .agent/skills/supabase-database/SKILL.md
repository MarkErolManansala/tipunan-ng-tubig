# Skill: Supabase Database

## When to Use

Use this skill when creating or changing database schema, tables, indexes, RLS policies, repositories, or type generation.

## Steps

1. **Read** `.ai/rules/database.md` (authoritative DB rules) and `.ai/rules/security.md` (RLS requirements). Check `docs/FILE_STRUCTURE.md` for where database code lives.
2. **Design before writing SQL.** Determine tables, relationships, unique constraints, and indexes from the actual data contract (see `.agent/skills/tubig-api-sync/SKILL.md` for verified API shapes). Propose the design if it adds a new concept beyond the existing migration history.
3. **Write a migration**: a new timestamped file in `supabase/migrations/`. Never edit an already-applied migration. Every migration that creates a table must also enable RLS on it.
4. **Conventions per table:** `created_at timestamptz not null default now()`; `timestamptz` for instants; `numeric` for measurements; nullable = unknown (no zero/empty defaults).
5. **Client configuration:** use the server client factory (`lib/supabase/server.ts` pattern) — anon key for public reads, secret key only in server-side write paths. Never create ad-hoc clients with hard-coded URLs/keys.
6. **Type generation:** where practical, run Supabase CLI `gen types` and commit the output; repositories type against it.
7. **Repositories** live in `features/<domain>/repositories/`, receive the Supabase client as a parameter, and are the only code issuing queries. Upserts declare an explicit `onConflict` matching a real migration constraint.
8. **Transactions:** `supabase-js` has no multi-statement transactions — design writes to be idempotent instead, or use a Postgres function (RPC) defined in a migration for true multi-table atomicity.
9. **Migration validation:** apply locally with the Supabase CLI (`supabase db reset` or `supabase migration up`) and confirm the schema. Note rollback considerations in the migration header comment (what breaks if reverted).

## Constraints

- **Never introduce Prisma or any other ORM** (see `.ai/rules/database.md` for the full prohibition).
- No `anon`/`authenticated` write grants — sync writes run under the server's secret key.
- Do not hand-roll SQL injection-prone string interpolation; `supabase-js` parameterizes queries.

## Verification

- [ ] Migration applies cleanly on a fresh local database
- [ ] RLS enabled on every new table; policies checked
- [ ] Unique constraints match repository `onConflict` targets
- [ ] `pnpm lint`, `pnpm type-check`, `pnpm test` pass
