# Task 0.3 — ADR set (0001–0006)

**Phase:** 0 · **ID:** T0.3 · **Depends on:** T0.2

## Objective

The design voice of the repo: six short ADRs that later phases cite instead of
restating rationale.

## Subtasks

- [x] `0001-service-boundaries.md` — context map (4 services + gateway + web),
      why 4 not 12, **when we WOULD split**, SSE owner per G-E, event-config
      rule (commerce treats `event_id` as opaque — no sync call to vote).
- [x] `0002-contracts-first.md` — polyglot seam rules: `contracts/` is the only
      shared artifact; no cross-language imports; **server-conformance rule**
      (implementation validated against its OpenAPI, review finding B2);
      oasdiff baseline policy.
- [x] `0003-integration-outbox-kafka.md` — no sync money calls, no
      dual-writes, outbox poller first / Debezium as stretch, partition-key
      = aggregate id, at-least-once + idempotent consumers, DLQ topic.
- [x] `0004-data-per-service.md` — database-per-service, PG×2 (vote=PostGIS),
      Redis namespace-per-service, Mongo for projections only.
- [x] `0005-k8s-local-first-eks-later.md` — kind first, EKS last, delete
      playbook before create, ap-southeast-1 only.
- [x] `0006-store-selection-v2.md` — Dynamo dropped, RabbitMQ dropped, Mongo
      kept (append-heavy feed + aggregation pipelines + CV skill), Kafka-only bus.
- [x] Each ADR ≤ 2 pages; status: Accepted; date + gate reference.

## Done when

- 6 ADR files exist; ADR-0007 already added by T0.2 → set is 0001–0007.

## Verification

- `ls docs/adr/` shows 0001–0007; each cites its decision gate ID.
