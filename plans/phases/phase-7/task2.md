# Task 7.2 — Zero-downtime rollout proof

**Phase:** 7 · **ID:** T7.2 · **Depends on:** T7.1

## Objective

Prove rolling updates don't drop requests — with load running during the
rollout, not after.

## Subtasks

- [ ] Script `make rollout-proof`: start `load/k6` at **200 RPS steady**,
      trigger `helm upgrade` mid-run (image tag bump on one service), wait for
      rollout completion.
- [ ] Assertions: **0 failed requests** during the whole run; p95 stays
      within budget; old pods terminate only after new pods Ready
      (maxUnavailable=0 behavior observed in events).
- [ ] Edge case check: in-flight requests to terminating pods complete
      (graceful shutdown, preStop hook if needed) — connection-reset count
      asserted 0 or documented with mitigation.
- [ ] Record result in `docs/capacity.md` / runbook (rollout procedure).

## Done when

- Rollout proof green: 0 failures at 200 RPS through a live `helm upgrade`.

## Verification

```bash
make deploy-kind && make smoke && make rollout-proof
```
