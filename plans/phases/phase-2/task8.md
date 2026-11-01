# Task 2.8 — Event ownership + `vote.cast` publish

**Phase:** 2 · **ID:** T2.8 · **Depends on:** T1.5 (skeleton outbox), T2.3

## Objective

Promote the Phase 1 outbox stub to the real `vote.cast` event with a
CI-verified ownership row.

## Subtasks

- [ ] Outbox row written in the SAME tx as ballot persistence (vote.cast
      payload: event id, user id (hashed/pseudonymized per privacy decision in
      `docs/decisions.md`), candidate/choice, points, occurred_at, traceparent).
- [ ] Relay publishes to `vote.cast` (partition key = event id → per-event
      ordering); at-least-once; **DLQ topic** after 10 attempts (v1 D-16 class).
- [ ] `contracts/event-ownership.md`: `vote.cast` row — producer `vote`,
      consumers `analytics`, guarantee at-least-once, retry policy, DLQ topic.
- [ ] CI cross-check passes: message has ≥1 producer AND ≥1 consumer; payload
      validates against AsyncAPI schema in a consumer-side test (analytics
      stub from T1.5 already consumes — now schema-validated).
- [ ] Backlog gauge: outbox age/rows exported as a metric (RED-adjacent —
      alertable in Phase 8).

## Done when

- Consumer test sees `vote.cast` matching AsyncAPI; ownership row green in CI;
  DLQ path unit-tested (poison payload → DLQ, not crash loop).

## Verification

```bash
make contract && make e2e   # AsyncAPI validation + end-to-end consume
```
