# Task 1.5 — Prove the async path in the skeleton too

**Phase:** 1 · **ID:** T1.5 · **Depends on:** T1.4, Kafka in compose

## Objective

ONE real event end-to-end in Phase 1 — bus integration risk surfaces now, not
in Phase 5.

## Subtasks

- [x] Vote stub endpoint writes an **outbox row** in the same tx as its state
      change (real outbox table, even though domain logic is a stub).
- [x] Outbox relay (poller, `UPDATE…RETURNING` claim) publishes to Kafka topic
      `vote.cast` with `traceparent` in headers, partition key = event id.
- [x] Analytics stub consumer (consumer group `analytics`) writes a Mongo doc
      keyed by event id; manual commit after side-effect.
- [x] `make e2e` assertion: vote request → Mongo doc visible **< 1 s** (poll
      10× at 100 ms, fail on timeout).
- [x] Negative: kill the relay mid-test → outbox rows accumulate, relay
      restart → docs appear (proves at-least-once, no loss).

## Done when

- Positive + negative async assertions green in `make e2e`; outbox rows never
  lost when relay restarts.

## Verification

```bash
make e2e   # includes async doc < 1s assertion
```

## Notes

This is the pattern Phase 2 (vote) and Phase 3 (commerce) reuse verbatim —
skeleton here, domain logic later.
