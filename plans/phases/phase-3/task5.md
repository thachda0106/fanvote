# Task 3.5 — Prove it (concurrency, idempotency, breaker, load)

**Phase:** 3 · **ID:** T3.5 · **Depends on:** T3.4, T2.7

## Objective

Invariants under concurrency + typed degradation under failure + a relative
checkout capacity number.

## Subtasks

- [ ] **50 concurrent last-seat checkouts** → `SOLD == 1`, all others typed
      rejected (no oversell, no 5xx for user errors); values asserted from DB.
- [ ] **Webhook ×10 (same delivery id) → effect ×1** — replay protection proven.
- [ ] **Breaker:** 100% PSP gateway failure (FAULT_RATE=1) → breaker opens,
      checkout degrades to *typed* 503 (`DEPENDENCY_UNAVAILABLE`), no
      connection-pool exhaustion, pool metrics bounded.
- [ ] `load/k6/hot-drop.js` — hot single-event checkout ramp → record
      **≥ 300 res/s** target attainment in `docs/capacity.md` with
      `source: kind-local` (G-C).
- [ ] Contract conformance (T2.7) applied to all commerce routes incl. error
      envelopes; capacity row for vote path re-run (no regression vs T2.4).

## Done when

- All three invariant/failure tests green; hot-drop row recorded with source;
  no invariant violations across the phase gate run.

## Verification

```bash
make e2e && make load   # invariant tests + hot-drop capacity row
```
