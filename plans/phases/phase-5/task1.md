# Task 5.1 — Consumers only — never the truth (B6)

**Phase:** 5 · **ID:** T5.1 · **Depends on:** T2.8, T3.3 · **Kills v1 D-08/09/10
in reverse; kills review finding B6**

## Objective

Kafka consumers + Mongo feed + notify fan-out, with producer contracts
existing first and duplicate delivery proven harmless.

## Subtasks

- [ ] `services/analytics/`: consume `vote.cast` / `ticket.confirmed`
      (consumer group `analytics`, **manual commit AFTER side-effect**).
- [ ] **Idempotency (B6):** unique index on event id (+ type) in Mongo;
      handler upserts — a redelivered event produces ONE activity doc. Test:
      deliver the same payload twice → one doc.
- [ ] Mongo activity feed: powers leaderboard history + votes-per-minute
      aggregates (aggregation pipelines — ADR-0006 justification made real).
- [ ] Notify fan-out: `notification.requested` → email/push **provider stub**
      + template rendering; provider failure → retry with backoff → DLQ.
- [ ] v1 D-08/09/10 reversal: CI enforces every AsyncAPI message has ≥1
      producer AND ≥1 consumer (from T0.4) — a consumer with no producer
      cannot merge.
- [ ] **Consumer-driven verification (lightweight):** analytics' test pulls
      the `ticket.confirmed` schema and **commerce CI verifies its real
      payload against it** (no Pact broker until a third consumer exists).
- [ ] Conformance harness on any HTTP endpoints (activity feed queries).

## Done when

- Duplicate-delivery test proves single doc; CDV check wired into commerce CI.

## Verification

```bash
make test && make contract   # analytics suite + CDV payload check
```
