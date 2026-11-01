# ADR-0003 — Integration: transactional outbox → Kafka (no sync money, no dual-writes)

- **Status:** Accepted
- **Date:** 2026-10-31
- **Phase:** 0 (T0.3) · **Gates:** 4 (Kafka only), 5 (delivery) · kills D-03,
  D-16, R-15, R-21, R-22 class defects

## Context

Cross-service effects: a vote must eventually reach the activity feed; a
payment must eventually confirm a ticket and notify the fan. v1 wrote DB rows
and published messages in separate steps (dual-write), used a commit-then-send
outbox whose `SKIP LOCKED` protection evaporated on commit (D-03), had no
attempt ceiling (D-16), and ran two buses (RabbitMQ + SQS) neither of which
was provisioned.

## Decision

1. **One bus: Apache Kafka** (gate 4). Local = KRaft ×3 brokers; EKS =
   Strimzi operator (gate 5). No RabbitMQ, no SQS.
2. **Transactional outbox, claim-then-send:** every state change that must
   emit an event writes the outbox row **in the same DB transaction** as the
   aggregate change. A relay claims rows by *marking* them
   (`UPDATE … SET claimed_at, attempts+1 … WHERE … RETURNING`) — never
   commit-then-send (D-03), never session advisory locks across a pool
   (D-04). Outbox **poller first**; Debezium CDC = stretch (gate 5).
3. **No synchronous money calls.** Money never crosses a sync boundary:
   gateway→commerce is the only sync hop that touches orders; payments,
   confirmations, notifications are events. No service calls another service
   synchronously except gateway→service (plan cross-service rules).
4. **Partition key = aggregate id** (`order_id`, `event_id`/`vote_id`) →
   per-aggregate ordering; consumers are **idempotent** (dedupe on event id)
   because delivery is **at-least-once**.
5. **Attempt ceiling + DLQ:** after 10 failed attempts the event goes to a
   `<source>.dlq` **topic** (not a silent infinite retry — D-16/R-21); DLQ
   depth is metered and alerted (Phase 8), drain procedure in the runbook.
6. **Schema = JSON + AsyncAPI first** (gate 5); Schema Registry only at the
   first breaking schema change.

## Consequences

- **Gained:** no dual-write divergence; crash between commit and publish loses
  nothing (relay retries); one failure model and one ops story for all
  events; ordering per aggregate where it matters (order state machine).
- **Gave up:** exactly-once plumbing (we buy it back with idempotent
  consumers + keyed partitions); poll-interval latency floor (~≤1 s, same as
  v1 R-22 — acceptable, documented); CDC-based outbox (deferred).
- **Cost:** outbox table growth → retention policy (Q-50: 30 days).

## Alternatives

- **Sync service-to-service calls (choreography via HTTP):** couples
  availability, puts money on the sync path, needs distributed tracing just
  to debug a checkout. Rejected.
- **Dual-write (DB + direct Kafka publish):** crash window loses or
  duplicates events irrecoverably. Rejected (v1 class).
- **Debezium CDC day 1:** powerful but another moving part before the
  walking skeleton; poller proves the pattern first. Stretch.
- **Two buses (v1):** two failure models, two unprovisioned deps. Rejected
  (gate 4).

## How to verify

Relay unit tests claim exactly-once-per-attempt semantics (T3.3); consumer
duplicate-delivery test → single effect (T5.1); poison message → DLQ not
crash loop (T5.2); chaos: lag drains on broker recovery, no duplicate side
effects (T6.2).