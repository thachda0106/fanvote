# Task 2.9 — Migrations for vote DB (G-H applied)

**Phase:** 2 · **ID:** T2.9 · **Depends on:** T0.7, T2.5

## Objective

First real schema; `make migrate-test` stops being a no-op for vote.

## Subtasks

- [ ] Migration files (node-pg-migrate per G-H, plain SQL): users/events
      tables as needed, ballots table with `UNIQUE (event_id, user_id)` +
      CHECKs, outbox table, PostGIS extension + GIST index (T2.5).
- [ ] Run all three suites from T0.7 against the vote DB:
  1. fresh init → schema + app boots;
  2. upgrade-from-previous (seed a vN fixture → migrate → data intact);
  3. expand-contract: add a nullable column migration → previous app version
     still runs (rolling-deploy safety) → then backfill + contract step.
- [ ] CI job switches from stub to real for the vote DB.
- [ ] Migration style rules in `docs/decisions.md`: expand-contract only,
      no destructive DDL in the same release as code that stops using the column.

## Done when

- `make migrate-test` green for vote DB in CI (all three suites).

## Verification

```bash
make migrate-test   # fresh + upgrade + expand-contract for vote DB
```
