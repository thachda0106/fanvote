# Task 5.5.3 — Realistic load shape (mixed-event-night)

**Phase:** 5.5 · **ID:** T5.5.3 · **Depends on:** T5.5.1, T2.1 (seed load-run)

## Objective

k6 follows the client's real journey instead of raw endpoint calls — numbers
mean something a fan actually does.

## Subtasks

- [ ] Rewrite `load/k6/mixed-event-night.js`: sequence
      **login → fetch event → vote → poll leaderboard → checkout**, with
      think-time distribution matching a fan (not machine-gun RPS).
- [ ] Uses `seed load-run`: fresh event id + user cohort per run (G-D);
      quota-aware (re-vote/429 responses counted separately, not as errors).
- [ ] Scenario mix: read-heavy browsing + vote bursts + checkout trickle;
      thresholds: p95 < 200 ms vote path, checkout ≥ 300 res/s phase target,
      error budget per ground rule 8 (typed 503 excluded).
- [ ] Output JSON → `docs/capacity.md` rows with `source: kind-local`.
- [ ] Analytics p95 < 500 ms assertion reused from T5.2 under this shape.

## Done when

- `make load` runs the client-shaped scenario green; capacity rows updated.

## Verification

```bash
make web-lighthouse && make load
```
