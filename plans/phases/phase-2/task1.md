# Task 2.1 — Seed / test-data factory

**Phase:** 2 · **ID:** T2.1 · **Depends on:** T1.3 · **Kills review finding B1,
enables G-D**

## Objective

One CLI that mints every entity any phase's tests and load runs need — users,
events (with PostGIS points), ticket inventory, and run-scoped load cohorts.

## Subtasks

- [ ] `seed/` CLI (Node or Python — pick one, document) with commands:
  - `seed users --count N [--prefix fan]` — identity-ready users (dev profile
    compatible with T1.3 mock issuer);
  - `seed events --count N [--venues hcmc,tokyo]` — PostGIS points for HCMC +
    Tokyo venues (+ a few random coords for near-query tests);
  - `seed tickets --event E --inventory N --price P` — commerce inventory rows
    (Phase 3 hooks in; stub now);
  - `seed load-run` — **fresh `event_id` + user cohort for one k6 run**
    (G-D: quota is per event/day → resets per run), prints the ids as JSON.
- [ ] Idempotent: re-running with same args doesn't duplicate (upserts).
- [ ] `make seed` (local stack) — wired to compose network.
- [ ] `seed/README.md`: quota semantics, why fresh events per run, cohort sizes
      (10k+ users for Phase 2 ramp).

## Done when

- `make seed` populates a fresh local stack; `seed load-run` returns a usable
  event id + cohort consumed by `load/k6/vote-ramp.js`.

## Verification

```bash
make up && make seed && make load   # k6 uses a fresh event per run
```
