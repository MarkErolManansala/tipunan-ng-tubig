# Skill: Project Structure

## When to Use

Use this skill whenever you create, move, or modify project files — adding a feature, a route, a library module, a test, or changing where code lives.

## Steps

1. **Read context first.** Read `AGENTS.md`, then the applicable `.ai/rules/*.md` files (at minimum `architecture.md` and `coding-standards.md`), and `docs/FILE_STRUCTURE.md`.
2. **Inspect before editing.** Look at the existing code around your target area — real imports, naming, error-handling patterns. Unfamiliar files may be in-progress user work; do not overwrite without understanding them.
3. **Determine placement** using the file-placement table in `.ai/rules/architecture.md`. If the placement is ambiguous or new, stop and propose it before creating anything.
4. **Reuse, don't duplicate.** Check whether an abstraction for this need already exists (client factories, error types, validation helpers). Extend rather than add a parallel implementation.
5. **Respect layering:** `app/ → features/ → lib/ → types/`. No exceptions without an architecture-document update.
6. **Update documentation when structure changes.** If you add a new top-level directory, a new module, or change a module's responsibility, update `docs/FILE_STRUCTURE.md` in the same change.
7. **Verify.** Run `pnpm lint`, `pnpm type-check`, and `pnpm test` (see `.ai/rules/testing.md`). Fix what you broke before finishing.

## Constraints

- Nothing counts as implemented until the file exists. Do not describe planned directories as real in docs — mark them planned.
- Keep `.ai/rules/` focused on stable constraints; put step-by-step workflow details in skills, not rules.
- Never introduce a dependency without a demonstrated requirement.

## Verification

- [ ] File is in the location the placement table dictates
- [ ] Imports use `@/` and respect layering
- [ ] `pnpm lint`, `pnpm type-check`, `pnpm test` pass
- [ ] `docs/FILE_STRUCTURE.md` updated if the structure changed
