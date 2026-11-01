# Phase 0 Explain gate — boundary + gateway defense notes

> **Phase 0 · Explain gate artifact** (plan: "defend service boundaries +
> gateway choice — record in `docs/learning/`"). The defense is **oral**,
> given by the owner; this file is the crib sheet + the record. No phase
> closes without the 6-point record completed below.

## Defense material (ready before the oral pass)

### 1. Why 4 services, not 12 (and not 1) — ADR-0001

- Four = independent change/failure/data domains the product actually has:
  identity, vote truth, money, projections.
- Beyond 4 (notify-service, seat-service, catalog-service…) = YAGNI until a
  **load number** or org fact demands it — every split adds a contract,
  pipeline, and pager surface for zero new lesson.
- Not 1: the artifact's whole claim (polyglot + contract-first seam +
  independent deploys) requires real seams; a monolith makes it a v1 rewrite.
- **Ground rule 1, said out loud:** at day-job scale the honest answer is
  still a modular monolith. Microservices is justified *here* only:
  greenfield, zero legacy users, learning artifact.
- **When we WOULD split:** measured contention inside a context (vote
  catalog vs hot path), divergent SLAs (notify vs feed), or irreconcilable
  deploy cadences — split the *deploy* first, the *service* second.

### 2. Gateway choice G-A + rejected alternatives — ADR-0007

- **Chosen: Envoy Gateway (OSS)** — Gateway API `SecurityPolicy` with
  `remoteJWKS.uri` → identity JWKS, `issuer`/`audiences` checked at edge,
  cache + refresh-on-unknown-`kid` (rotation without restart);
  `BackendTrafficPolicy` = per-route local rate limits (vote strict /
  analytics conservative / health+metrics never routed).
- **Rejected:**
  - Kong OSS `jwt` — per-consumer **static** keys only, no JWKS
    fetch/rotation (review finding A1 — the thing that forced this gate);
  - Kong `openid-connect` — Enterprise-only;
  - custom Kong plugin — +2 days Lua, own cache/rotation bugs, documented
    rotation gap as "accepted risk";
  - thin NestJS BFF — home-made proxy reads junior; concentrates edge
    duties in app code;
  - Apache APISIX — viable OSS peer; Envoy Gateway chosen for first-class
    declarative SecurityPolicy/BackendTrafficPolicy and one less custom
    ingress controller.
- **Pre-filter ≠ authority:** edge rejects garbage cheaply; every service
  still verifies JWTs locally from a cached JWKS (zero identity hop,
  rotation-safe). Bypass the gateway inside the cluster → services still
  say no. Services never trust client-supplied identity headers
  (NetworkPolicy + audience JWT, gate 11).

### 3. Seam that makes 4 services survivable — ADR-0002

Contracts only: OpenAPI/AsyncAPI in `contracts/` are the sole shared
artifact; spectral + oasdiff (`--fail-on ERR` vs committed baseline) +
producer/consumer cross-check are the merge rules; server-conformance
harness starts Phase 2 (B2).

### 4. Correctness posture frozen in Phase 0 (cite by ID)

Quota 10/event/day GMT+7 one enforcement point (Q-07/Q-26) · no re-vote
(Q-27) · idempotency scoped per user (Q-11) · webhook raw bytes (Q-39/D-02)
· JWKS always (Q-04/D-01) · Redis OAuth flow (Q-05/D-11) · readiness 503
(D-12) · 5xx on error path (Q-17/D-14) · load provenance
`source:` field (Q-52/G-C) · fresh event per k6 run (G-D).

### 5. Failure behavior / limits / 10× (to be stated live)

- Edge down → in-cluster callers still need valid JWTs (services verify).
- Identity JWKS down → cached keys keep verifying until TTL; unknown `kid`
  forces refetch → typed 503, not silent accept.
- 10× RPS → local rate-limit buckets are per-gateway-instance (accepted
  limitation; global limiter = stretch); vote path bounded by Redis Lua +
  PG unique, not by gateway.
- What changes at 10×: revisit per-route limits, consider global ratelimit
  service, Kafka partitions, and — per ground rule 1 — some of these
  services would collapse back into fewer deployables at org scale.

## Record

| Field | Value |
|---|---|
| Defended by | _pending — owner_ |
| Date | _pending_ |
| Pass / revise | _pending_ |
| Notes | _pending_ |

**Until this table is filled, Phase 0 is not closed** (understanding loop
step 6 — "no phase closes without it").