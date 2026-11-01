# ADR-0006 — Store selection for v2: drop Dynamo + RabbitMQ, keep Mongo, Kafka-only

- **Status:** Accepted
- **Date:** 2026-10-31
- **Phase:** 0 (T0.3) · **Gates:** 3 (Dynamo), 4 (RabbitMQ), 5 (Kafka),
  10 (Mongo)

## Context

v1's datastore set grew by accretion: DynamoDB for a vote fact PG already
held uniquely; RabbitMQ for notifications while payments went through SQS;
Mongo for a feed nothing wrote; Redis everywhere; one shared PG. Every engine
is another boot dependency (R-17), another unprovisioned Terraform gap
(Q-40/Q-41), another failure model. The rebuild gets to choose the minimum
set that still ships the product and the interview lessons.

## Decision

| v1 store | v2 | Why |
|---|---|---|
| PostgreSQL (shared) | **Kept — split per service** (vote+PostGIS, commerce, identity) | system of record; database-per-service (ADR-0004) |
| Redis | **Kept — one cluster, namespaced keys** | counters, quota Lua, flow state, holds; fail-loud `noeviction` |
| DynamoDB | **Dropped** (gate 3) | second store for a fact PG already enforces via `UNIQUE (event_id, user_id)`; 4 engines → 3; one backstop, one truth |
| RabbitMQ | **Dropped** (gate 4) | notification fan-out moves to Kafka; no second broker, no AWS MQ decision |
| SQS (+ LocalStack) | **Dropped** (gate 4/5) | payment events move to Kafka outbox topics — one bus |
| MongoDB | **Kept** (gate 10) | append-heavy activity feed + aggregation pipelines (votes-per-minute); ADR-0006-of-v1 justified it; CV-listed skill; **projections only** |
| — | **Apache Kafka (new)** (gate 5) | the single integration bus: KRaft ×3 local, Strimzi on EKS; JSON + AsyncAPI; outbox poller first |

Explicit non-goals: Schema Registry until first schema break; Debezium CDC
until the poller proves insufficient; Linkerd/mTLS (NetworkPolicy + audience
JWT instead, gate 11); KEDA until a load number demands RPS metrics (G-F).

## Consequences

- **Gained:** three datastore engines (PG/Redis/Mongo) + one bus (Kafka);
  boot never requires five systems (Phase 6: no `process.exit` on datastore
  blip); one delivery semantics to teach (at-least-once + idempotent
  consumers); compose fits 16 GB (CI: slim 1-broker profile).
- **Gave up:** Dynamo's managed durability story (PG Multi-AZ + PITR in
  Phase 9 covers it — Q-43); Rabbit's routing fabric (Kafka topics +
  consumer groups cover fan-out); SQS-vs-Rabbit "know both" breadth (we
  teach Kafka deeper instead).
- **Risk:** Kafka ops learning curve — mitigated: KRaft = no ZooKeeper, 3
  brokers max, consumer-lag alert (Phase 8), Strimzi only in the Phase 9 lab.

## Alternatives

- **Keep Dynamo for votes (v1 pattern):** conditional-write lesson is real,
  but two truths for one fact invites drift; the PG unique backstop already
  teaches the same invariant with fewer moving parts. Rejected.
- **Keep both buses:** two failure models, two sets of DLQ/retry policy,
  double the chaos surface. Rejected (gate 4).
- **Drop Mongo (PG-only):** viable; loses aggregation-pipeline practice and
  the projection-vs-truth separation with a *different* engine — gate 10 keeps
  it deliberately.
- **Pulsar/NATS/Redpanda:** fine tech, zero product need; Kafka is the
  CV-relevant, best-documented choice. Rejected.

## How to verify

Compose inventory matches this table exactly (T0.5); `event-ownership.md`
rows = Kafka channels only (T0.4 CI cross-check); no service boots against
Dynamo/Rabbit/SQS symbols (grep gate in review); chaos suite covers
broker-down + lag drain (T6.2).