# Task 3.6 — Migrations for commerce DB

**Phase:** 3 · **ID:** T3.6 · **Depends on:** T0.7, T3.2 · **Acceptance half
of T3.4(b)**

## Objective

Flyway migrations that survive a rolling deploy — expand-contract, not
rewrite-in-place.

## Subtasks

- [ ] Versioned Flyway migrations: orders, payments, ticket_inventory,
      outbox; CHECK constraints + unique backstops (T3.2); indexes for the
      hot queries (seat lookup, outbox claim).
- [ ] Run the three `make migrate-test` suites against commerce DB:
  1. fresh init → schema + boot;
  2. upgrade-from-previous → data intact, constraints valid on legacy rows;
  3. expand-contract → old app pod runs against expanded schema (rolling
     deploy safety), then contract migration after code rollout.
- [ ] Constraint-on-legacy-data check: suite 2 validates existing rows satisfy
      new CHECKs (or data fix migration precedes the constraint).
- [ ] CI job runs migrate-test for BOTH PG databases from here on.
- [ ] Capacity note: outbox claim index under load (no seq-scan growth) —
      quick EXPLAIN assertion if cheap, else recorded in capacity doc.

## Done when

- `make migrate-test` green for commerce DB in CI (all three suites), both
  DBs covered.

## Verification

```bash
make migrate-test   # vote + commerce, fresh + upgrade + expand-contract
```
