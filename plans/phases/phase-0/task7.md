# Task 0.7 — Migration tooling decision wired into Makefile

**Phase:** 0 · **ID:** T0.7 · **Depends on:** G-H · **Kills B3**

## Objective

Migration test *conventions* exist now; real schema bodies land in Phase 2/3.

## Subtasks

- [x] G-H answer recorded: default **node-pg-migrate** (plain SQL) for both
      NestJS services (identity, vote); Flyway for commerce; document choice in
      `docs/decisions.md`.
- [x] `make migrate-test` target runs three suites:
  1. **fresh init** — empty DB → latest schema, app boots;
  2. **upgrade-from-previous** — apply previous release schema + data, then
     migrate, assert data survives;
  3. **expand-contract** — old app version runs against the expanded schema
     (rolling-deploy safety).
- [x] Directory conventions: `services/<name>/migrations/` (numbered, plain
      SQL preferred), `tests/migrate/` fixtures per suite.
- [x] Target no-ops cleanly while schemas are empty (Phase 0 state).

## Done when

- `make migrate-test` exists, exits 0 on empty schemas, and CI job stub calls it.

## Verification

```bash
make migrate-test   # green (no-op) in Phase 0; must be real by T2.9 / T3.6
```
