# ADR-0004 — Data per service: database-per-service, three datastore engines

- **Status:** Accepted
- **Date:** 2026-10-31
- **Phase:** 0 (T0.3) · **Gates:** 3 (Dynamo dropped), 6 (Redis namespacing),
  10 (Mongo kept)

## Context

v1 ran five engines (PG shared by all modules, Redis, Mongo, DynamoDB, plus
RabbitMQ/SQS as state): Dynamo duplicated the PG vote unique constraint,
Mongo's feed was never written, and one shared Postgres meant "service
autonomy" existed only on paper. v2 picks the minimum store set that still
teaches real patterns.

## Decision

**Database-per-service** — no service reads another service's database, ever.

| Store | Instance (local compose / Phase 9) | Logical DB | Owner | Role |
|---|---|---|---|---|
| PostgreSQL | `pg-vote` — **`postgis/postgis` image** | `vote` | vote | vote ledger, quota ledger, event catalog (`geography(Point,4326)` + GIST) |
| PostgreSQL | `pg-app` — plain `postgres` | `identity` | identity | users, refresh tokens |
| PostgreSQL | `pg-app` (same instance, separate DB + credentials) | `commerce` | commerce | orders, payments, tickets, inventory, outbox |
| Redis | one cluster, all services | — | namespaced | quota Lua, edge/local rate limits, leaderboard counters, OAuth flow state, seat holds |
| MongoDB | one instance | — | analytics | activity feed + aggregation pipelines — **projections only, never truth** |

**PostgreSQL ×2 instances / 3 logical databases** (plan tech stack caps PG at
×2; Phase 9 Terraform provisions 2 RDS databases-shaped instances — vote gets
the PostGIS-enabled one). Instance co-location of `identity` + `commerce` is
an **infra/cost detail only**: separate databases, separate roles, zero
cross-database grants or queries. If either ever needs independent
backup/restore or a Postgres extension, it gets its own instance — split
instances, never split honesty about sharing one.

Refinements:

- **Redis = one cluster, namespace-per-service** (gate 6): key prefixes
  `vote:*`, `identity:*`, `commerce:*`, `analytics:*` — shared memory
  footprint, hard key-prefix discipline (v1 key-prefix bug class); eviction
  policy explicit (`noeviction` + memory alert — vote writes fail loudly
  rather than silently evict).
- **Mongo holds projections only** (gate 10): truth stays in PG; the feed is
  rebuildable from Kafka events; Mongo outage degrades reads, never
  correctness.
- **No DynamoDB** (gate 3): the durable duplicate-vote backstop is PG
  `UNIQUE (event_id, user_id)` — one truth store, one constraint. Correctness
  layers = gateway limit → Redis Lua → PG unique (Phase 2).
- Cross-context data access = contract calls (read side, composed by web) or
  events (write side) — never joins across databases.

## Consequences

- **Gained:** migration/deploy autonomy per service, polyglot-friendly
  stores, PostGIS claim backed by a GIST-indexed near-query test, three
  engines instead of five, 2-PG instance footprint matching the plan's
  hardware floor.
- **Gave up:** cross-service JOIN convenience; Redis is shared infra
  (namespacing + per-key tests mitigate); analytics can lag (by design —
  at-least-once, < 1 s target); `identity` and `commerce` share a PG
  *instance* (accepted until a split trigger above fires).
- **Ops:** `pg-vote` + `pg-app` + Redis + Mongo + Kafka×3 locally; CI slim
  profile for 7 GB runners (B4).

## Alternatives

- **Shared PG with schemas-per-service (v1 shape):** no migration autonomy,
  accidental coupling via grants/search_path. Rejected.
- **Three PG instances from day 1:** cleaner isolation, +1 container and +1
  RDS line before any load demands it. Deferred — split trigger documented.
- **PG-only (drop Mongo):** possible; loses append-heavy feed +
  aggregation-pipeline lesson and a CV-listed skill (gate 10 keeps Mongo).
- **Dynamo for votes (v1):** second truth store for the same fact (gate 3).

## How to verify

Compose inventory matches the table (T0.5); Phase 2 proves the three vote
layers incl. deliberate Redis bypass → PG backstop (T2.3); near-query
EXPLAIN asserts a GIST index scan (T2.5); review rule: no service's
connection string targets another service's logical DB.