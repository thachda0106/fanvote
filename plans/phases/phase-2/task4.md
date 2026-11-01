# Task 2.4 — Prove it (concurrency + ramp)

**Phase:** 2 · **ID:** T2.4 · **Depends on:** T2.3, T2.1

## Objective

Value-level correctness under concurrency, and a first (relative) capacity
number.

## Subtasks

- [ ] `services/voting/test/voting.e2e-spec.ts`:
  - **500 concurrent votes for the SAME (event,user)** → accepted == 1,
    rejected == 499 with typed reasons; **values asserted**: leaderboard total
    == sum(ledger rows) — not just counts, not just latency;
  - quota race: N concurrent users × over-quota attempts → no user exceeds
    10 points/day (sum per user asserted from PG, source of truth);
  - Redis-flush mid-test → backstop still holds.
- [ ] `load/k6/vote-ramp.js`:
  - uses `seed load-run` fresh event + cohort (G-D);
  - ramp shape (e.g. 100→2k RPS in steps), measures knee, p50/p95/p99,
    429/503 rates, error rate (ground rule 8 thresholds);
  - outputs JSON → `make load` parses into `docs/capacity.md`.
- [ ] `docs/capacity.md` row: metric, value, **`source: kind-local`**
      (G-C — local = relative regression only).

## Done when

- e2e invariant tests green (value assertions); capacity row recorded with
  source field; ramp shows a definable knee (or documents hitting RPS ceiling).

## Verification

```bash
make e2e && make load   # invariant tests + capacity row written
```
