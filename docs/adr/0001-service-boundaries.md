# ADR-0001 — Service boundaries: 4 bounded contexts + gateway + thin client

- **Status:** Accepted
- **Date:** 2026-10-31
- **Phase:** 0 (T0.3) · **Gates:** G-E (SSE owner), plan ground rules 1–2

## Context

Greenfield rebuild of a fan-engagement product (voting, ticketing, analytics,
notifications) as a polyglot platform. v1 was one NestJS monolith where every
module shared one process, one DB, and one deploy — module boundaries existed
on disk only. The rewrite must decide how many services to ship and where each
capability lives, without over-splitting (YAGNI) or re-monolithing.

## Decision

Exactly **4 backend services + 1 gateway + 1 thin client**:

| Unit | Language | Bounded context / aggregate | Owns |
|---|---|---|---|
| gateway | Envoy Gateway (G-A) | edge | routing, per-route rate limit, JWT pre-filter |
| identity | NestJS 11 | auth identity | `User`, `RefreshToken`, RS256 tokens, JWKS, mock-IdP test mode |
| vote | NestJS 11 | voting | `Ballot`, quota, leaderboard, **event catalog (PostGIS)**, **SSE stream (G-E)** |
| commerce | Spring Boot 4 | ticketing + payments | `Order` state machine, `Payment`, `TicketInventory` |
| analytics | FastAPI | projections | activity feed, aggregates, notify fan-out — **never truth** |
| web | Next.js 15 | client | 3 pages (event, leaderboard, checkout); talks only to the gateway |

### Why 4, not 12

- Four is the number of **independent change/failure/data domains** the
  product actually has: identity, vote truth, money, projections. Splitting
  further (e.g. "catalog service" vs "vote service", "notify" as its own
  service) multiplies deploy/contract/ops surface with zero load or team
  justification — the plan's cap is deliberate (ground rule 2).
- Polyglot is the learning artifact; **contracts are the seam** (ADR-0002) —
  more services would multiply contract surface without new lessons.

### When we WOULD split

Split an existing context only when a **load number or org fact** demands it,
e.g.: vote reads (leaderboard) outgrow the write path → separate read model;
notify delivery volume/SLA diverges → its own consumer deployment; event
catalog becomes multi-tenant admin-heavy → own service. Not before.

### SSE owner (G-E)

**vote** serves `GET /api/v1/events/{id}/stream` — the leaderboard is its
data; a separate realtime service would re-export vote truth. Fallback = 1 s
polling. If gateway buffering fights the long-lived connection, ship
polling-first and keep SSE as stretch (evidence recorded in the task).

### Event-config rule (cross-context, C-B5)

vote owns the event **catalog**; commerce owns ticket inventory **for** an
event. Commerce treats `event_id` as an **opaque foreign key**: price,
capacity, sale window are copied into commerce at inventory-creation time via
the seed/admin path — **never** a sync lookup into vote. The web event page
composes two contract calls (vote catalog + commerce inventory); that
composition is documented in the web task, not hidden in a BFF.

## Consequences

- **Gained:** independent deploys, per-service DB freedom (polyglot), clear
  fault isolation, a defensible interview answer for "why not a monolith"
  (and when a monolith wins — ground rule 1).
- **Gave up:** single-repo single-runtime simplicity; cross-context reads are
  eventually consistent or client-composed; four CI matrix legs.
- **Risk:** distributed-monolith drift — mitigated by the sync-call rule:
  only web→gateway and gateway→service are synchronous; everything else is
  Kafka events (ADR-0003).

## Alternatives

- **Modular monolith (v1 shape):** correct answer at day-job scale — stated
  out loud in interviews; rejected *here* because greenfield + learning
  artifact + zero legacy users is the one place microservices is justified.
- **12-service fine grain:** catalog/notify/quota/… — YAGNI; no load number.
- **BFF aggregation service:** would hide the event-config composition and
  add a fifth backend — rejected with G-A (gateway, not BFF).

## How to verify

Context map above matches `contracts/` ownership (T0.4 CI cross-check);
Explain gate: defend boundaries in `docs/learning/` before Phase 0 closes.