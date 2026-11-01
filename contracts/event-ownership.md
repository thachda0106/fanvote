# contracts/event-ownership.md — producer/consumer matrix + truth map

> CI (`scripts/check-ownership.mjs`) asserts: every channel in
> `asyncapi.yaml` has ≥1 producer **and** ≥1 consumer in the table below, and
> every table row matches a channel address. Review finding D-08/09/10 class:
> a consumer with no producer cannot merge.

## Ownership matrix

| Event | Channel address | Producer | Consumers | Delivery guarantee | Retry policy | DLQ topic |
|---|---|---|---|---|---|---|
| `vote.cast` | `eventista.vote.cast` | vote (outbox relay, T2.8) | analytics (group `analytics`, T5.1) | at-least-once, key = `event_id` | consumer: 10 attempts, jittered backoff → DLQ | `eventista.vote.cast.dlq` |
| `order.held` | `eventista.order.held` | commerce (outbox relay, T3.3) | analytics (group `analytics`) | at-least-once, key = `order_id` | consumer: 10 attempts → DLQ | `eventista.order.held.dlq` |
| `payment.captured` | `eventista.payment.captured` | commerce (outbox relay) | analytics (group `analytics`) | at-least-once, key = `order_id` | consumer: 10 attempts → DLQ | `eventista.payment.captured.dlq` |
| `payment.failed` | `eventista.payment.failed` | commerce (outbox relay) | analytics (group `analytics`) | at-least-once, key = `order_id` | consumer: 10 attempts → DLQ | `eventista.payment.failed.dlq` |
| `ticket.confirmed` | `eventista.ticket.confirmed` | commerce (outbox relay) | analytics (group `analytics`) | at-least-once, key = `order_id` | consumer: 10 attempts → DLQ; outbox-side retries before publish (never a 2nd charge) | `eventista.ticket.confirmed.dlq` |
| `notification.requested` | `eventista.notification.requested` | analytics (notify orchestrator) | analytics notify worker (group `analytics-notify`, provider stub Q-34) | at-least-once, key = `userId` | consumer: 10 attempts → DLQ | `eventista.notification.requested.dlq` |

Common rules (ADR-0003):

- Outbox rows are **claim-marked then published** (never commit-then-send);
  attempt ceiling 10, then the outbox row is dead-lettered **and** the event
  routes to the DLQ topic above.
- Consumers **must** dedupe on message header `id` (unique index / upsert) —
  at-least-once must not double-apply (B6).
- Partition key = aggregate id shown above → per-aggregate ordering only.
- Schemas: `contracts/asyncapi.yaml`; evolution gate vs
  `contracts/baseline/asyncapi.yaml`.

## Truth map

| Concern | Truth owner | Notes |
|---|---|---|
| Vote tallies / ballots / quota | **vote** (Postgres ledger) | Redis counters are a cache; analytics projections never override |
| Order + payment state | **commerce** (Postgres) | state machine + DB constraints are the backstop |
| Auth identity / tokens | **identity** (Postgres + JWKS) | services verify locally from cached JWKS (ADR-0007) |
| Activity feed, aggregates, notifications fan-out | **analytics** (Mongo) — *projections only* | rebuildable from events; never queried as truth by other services |
| Event catalog | **vote** (PostGIS) | commerce copies ticket config at inventory creation; `event_id` opaque thereafter (ADR-0001) |
| Ticket inventory / tickets | **commerce** | per-fan cap + oversell guards live here |

## Sync-call boundary (ADR-0001 / ADR-0003)

Allowed synchronous hops: **web → gateway → one service** only. No
service→service HTTP except gateway routing. Money never crosses a sync
boundary. Everything else is a row in the matrix above.