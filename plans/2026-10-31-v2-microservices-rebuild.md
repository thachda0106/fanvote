# eventista v2 — Full Microservices Rebuild Plan (v2.1 — phased with task breakdowns)

> **For Hermes:** plan-only artifact. v2.1 folds in the plan red-team review
> (A/B/C findings, see "Amendments folded in from review") and expands every
> phase into numbered tasks with subtasks + explicit done-when conditions.
> Execution is phase-by-phase; every phase ends green on its own gate.
> Supersedes `plans/2026-10-31-v2-microservices-rebuild.md` (v1 of this plan,
> kept in the parent workspace as history).

**Goal:** rebuild the entire Eventista fan-engagement product from scratch as a
**polyglot full-stack platform** — NestJS + Spring Boot 4 + FastAPI + Next.js behind an
API gateway, deployed on **Kubernetes (kind locally → EKS on AWS)**, proven by
**k6**, provisioned by **Terraform** — with clean DDD/hexagonal architecture and
the v1 defect inventory baked in as acceptance criteria.

**Architecture:** 4 bounded-context services + gateway + thin Next.js client,
database-per-service, outbox → **Kafka** for integration, OpenAPI/AsyncAPI
contracts as the *only* shared artifact between languages. Monorepo,
independently deployable images.

**Tech stack:** NestJS 11 (identity, voting) · Spring Boot 4.1 (commerce:
ticketing+payments) · FastAPI (analytics+notify) · Next.js 15 (fan client) ·
gateway per decision **G-A** (default below) · PostgreSQL ×2 (vote DB = PostGIS
image) · Redis · MongoDB · **Apache Kafka (KRaft, 3-broker local → Strimzi/MSK
on AWS)** · kind + kubectl + Helm · k6 · OpenTelemetry + Prometheus/Grafana/
Jaeger · Terraform · GitHub Actions.

---

## Ground rules (the counsel section — read first)

1. **Microservices is justified HERE and nowhere else.** Greenfield, learning +
   interview artifact, no legacy users. In production at your day-job scale, the
   answer would still be a modular monolith. Say that out loud in interviews —
   it's the senior answer.
2. **Bounded, not many:** exactly 4 services + gateway + a thin client. Splitting
   further is a YAGNI violation until a load number demands it.
3. **Contracts only, no shared code.** Polyglot monorepos rot the moment Python
   imports TypeScript. `contracts/` (OpenAPI + AsyncAPI) is the seam.
4. **Walking skeleton first:** end-to-end request → gateway → all 4 services →
   response, with tracing, by the end of Phase 1 — before any domain depth.
5. **v1 is the requirements oracle, not code to copy.** The 52 open questions
   (Q-01…Q-52) are answered ONCE in Phase 0 and become acceptance criteria.
   The D/R defect list becomes "this bug class must not recur" tests.
6. **Cloud rule:** every Terraform/EKS write op is a numbered command report
   **you** run. Local proof (kind, docker Kafka) needs no permission.
7. **Gates are cumulative and lazy** (C-fix): a target may be skipped while its
   prerequisites don't exist yet — `make e2e` is enforced from Phase 1 onward,
   `make load` from Phase 2, `make chaos` from Phase 6. Phase 0's gate is
   `make lint && make contract && make test` only.
8. **Gate numbers are thresholds, not aspirations** (C-fix): "0 INTERNAL_ERROR"
   is enforced as 0 in unit/e2e, `<0.01%` of requests in load runs, and typed
   `DEPENDENCY_UNAVAILABLE` 503s excluded from 5xx counts.

## Product rules locked from v1 (defaults — override in Phase 0)

| Rule | v2 decision | Kills |
|---|---|---|
| Free-vote quota | 10 points **per event per day** (GMT+7), ONE enforcement point | Q-07, Q-26, R-10 |
| Re-vote | Not allowed — DB unique `(event_id, user_id)` is final backstop | Q-27 |
| Idempotency keys | Scoped `UNIQUE (user_id, key)`, header validated → 400 | D-06, D-07 |
| Webhook signature | Over **raw bytes** captured in transport | D-02 |
| OAuth id_token | JWKS verify (iss/aud/exp) always — mock IdP signs too | D-01 |
| OAuth flow state | Redis, 10-min TTL — no per-process maps | D-11 |
| Readiness | 503 when degraded; liveness datastore-independent | D-12 |
| 5xx metrics | Recorded on error path — alerts must be provable | D-14, R-30 |
| Invariant tests | Assert **values** (leaderboard == ledger), not latency only | M7 lesson |
| Load data provenance | Local/kind runs = relative regression only; **absolute** capacity numbers only from Phase 9 EKS runs (G-C) | C-A3 |
| Auth in Phases 1–3 | Mock IdP (dev token issuer) ships in Phase 1; real identity in Phase 4 | C-A2 |
| Sustained load vs quota | Each load run creates a **fresh event id** → quota window resets per run (G-D) | C-A4 |

## Service decomposition (DDD bounded contexts → services)

| Service | Lang | Aggregate / owns | Store | Integration |
|---|---|---|---|---|
| **gateway** (per G-A) | — | routing, edge rate-limit, TLS, auth plug-in | — | → all services |
| **identity** | NestJS | `User`, `RefreshToken`, OAuth+RS256 JWT, **mock/dev IdP mode** | PG `identity` | signs tokens; JWKS endpoint |
| **vote** | NestJS | `Ballot` — one vote/fan, quota, leaderboard, **event catalog (PostGIS)**, SSE live leaderboard (pending G-E) | PG `vote` (PostGIS image) + Redis | publishes `vote.cast` → Kafka |
| **commerce** | Spring Boot 4 | `Order` state machine + `Payment` — holds, buys, charges | PG `commerce` | outbox → Kafka (key = aggregate id) |
| **analytics** | FastAPI | activity feed, aggregates, notifications fan-out | MongoDB + Redis | consumes Kafka only (consumer groups) |
| **web** | Next.js 15 | fan client: event page, live leaderboard, checkout | static/SSR, no DB | calls the gateway ONLY (OpenAPI-typed) |

Cross-service rules: **no distributed monolith** — synchronous calls only
web→gateway and gateway→service; services verify JWTs **locally from a cached
JWKS** (no per-request identity hop, rotation-safe); everything else is async
events. Money never crosses a sync boundary. Services never trust identity
headers from clients — see Task 4.3.

**Event-config rule (C-B5):** vote owns the event *catalog*; commerce owns
ticket inventory *for* an event. Commerce treats `event_id` as an **opaque
foreign key** — ticket configuration (price, capacity, sale window) is copied
into commerce at inventory-creation time via an admin/seed path, never looked
up with a sync call to vote. The web event page composes two contract calls
(vote catalog + commerce inventory); this composition is documented in the web
task, not hidden in a BFF.

## Target & SLOs (locked Phase 0, measured every phase)

- **Load:** 10,000 concurrent voters · 2,000 RPS vote path · p95 < 200 ms ·
  checkout ≥ 300 res/s · chaos survival (kill any pod mid-load) · cost ceiling
  documented (EKS lab ≈ $0.10/h control plane — same-day create/delete).
  **Proven on EKS (Phase 9)**; local runs record relative regressions only.
- **Availability (normal load):** 99.9% successful requests; overload →
  controlled, *typed* rejection (429/503), zero cascading failure.
- **Correctness (always — load or failure):** 0 invariant violations (no
  oversell, no double vote, no double charge, leaderboard == ledger); pod
  termination loses no committed data; recovery needs no manual data repair.
- **5xx taxonomy:** `INTERNAL_ERROR` (bugs) target **0 in unit/e2e, <0.01% in
  load**; typed `DEPENDENCY_UNAVAILABLE` 503s allowed AND metered during induced
  failures — availability and correctness measured separately.

## Repo layout (new repo `eventista2/` — G-B resolves final name)

```
eventista2/
├── contracts/openapi/{identity,vote,commerce,analytics}.yaml  # the seam
├── contracts/asyncapi.yaml                                    # event schemas
├── contracts/event-ownership.md                               # producer/consumer matrix
├── contracts/baseline/                                        # oasdiff baseline for CI (C-fix)
├── services/identity/     (NestJS: package.json, Dockerfile)
├── services/voting/       (NestJS)
├── services/commerce/     (Spring Boot 4: pom.xml [4.1.2, NOT .RELEASE])
├── services/analytics/    (FastAPI: pyproject.toml)
├── apps/web/              (Next.js 15 App Router — talks only to the gateway)
├── seed/                  # test-data factory: users, events, tickets, k6 cohorts (C-B1)
├── deploy/helm/{eventista,kind-config.yaml}
├── deploy/monitoring/alerts.yaml
├── infra/terraform/       (ECR, EKS ap-southeast-1, RDS, ElastiCache, Kafka/Strimzi)
├── load/k6/               (vote-ramp, event-night, hot-drop, soak, mixed-event-night)
├── load/chaos/            (Phase 6 scripts)
├── docs/adr/ · docs/decisions.md · docs/capacity.md · docs/runbook.md
├── docs/learning/ · docs/reviews/
├── Makefile · docker-compose.yml (datastores; + docker-compose.ci.yml 1-broker profile)
└── .github/workflows/ci.yml
```

Local hardware floor (C-fix): Docker Desktop / WSL2 with **≥ 16 GB RAM
(24 GB preferred)** — 2 PG + PostGIS + Redis + Mongo + Kafka×3 + gateway + kind.
CI uses the slim compose profile (1 Kafka broker, no Jaeger), local uses full.

---

## Amendments folded in from review (v2 → v2.1)

| ID | Finding | Where addressed |
|---|---|---|
| A1 | Kong OSS cannot do JWKS verification | **Gate G-A** + Task 0.3 |
| A2 | Identity is Phase 4 but auth needed in Phase 1–3 | Task 1.3 (mock IdP), Task 4.1 |
| A3 | Load environment / capacity provenance undefined | **Gate G-C** + Task 0.3 + SLOs |
| A4 | Quota vs sustained load conflict | **Gate G-D** + Task 2.8 |
| A5 | SSE endpoint has no owner | **Gate G-E** + Tasks 2.6 / 5.5.1 |
| A6 | HPA custom RPS metric needs KEDA/adapter | **Gate G-F** + Task 7.1 |
| B1 | No seed/test-data factory | Task 2.1 |
| B2 | No server-side contract conformance | Task 2.7, enforced 3/4/5 |
| B3 | Migration tooling for NestJS services undecided | **Gate G-H** + Task 2.9 / 3.6 |
| B4 | CI cannot run full stack | Task 0.8 (`docker-compose.ci.yml`) |
| B5 | Event-config ownership across contexts | "Event-config rule" above |
| B6 | Analytics consumer idempotency | Task 5.1, chaos assertion 6.2 |
| B7 | No CI security scanning | Task 0.8 |
| C1 | Gate achievability / lazy gates | Ground rule 7 |
| C2 | INTERNAL_ERROR threshold | Ground rule 8 |
| C3 | oasdiff baseline bootstrap | Task 0.5 |
| C4 | LHCI needs stub mode | Task 5.5.2 |
| C5 | Repo name/location | **Gate G-B** |
| C6 | Version pins verified day one | Task 0.6 |
| C7 | Learning docs unmapped to phases | "Understanding loop" mapping |

---

## Decision gates — answer before Phase 0 ends (defaults stand if silent)

| # | Question | Default |
|---|---|---|
| **G-A** | **Gateway + JWKS verification (A1)** | **Envoy Gateway or Apache APISIX (OSS, remote-JWKS JWT auth)** — Kong OSS `jwt` plugin only supports per-consumer static keys (no JWKS fetch/rotation) and `openid-connect` is Enterprise. If Kong is kept for the name-recognition: custom plugin = +2 days, documented rotation gap = accepted risk. Decision recorded in ADR-0007. |
| **G-B** | Repo: name + location | Keep dir `eventista2/` (already created) as the repo root; v1 stays as requirements oracle. Rename to `eventista-v2` only before first push if preferred — decide once, never again. |
| 2 | Gateway: (see G-A) vs thin NestJS BFF? | **Real OSS gateway** — a home-made proxy reads junior in interviews |
| 3 | DynamoDB in v2? | **Drop** — PG unique index is the backstop; 4 datastores → 3 |
| 4 | RabbitMQ? | **Gone** — Kafka only: one bus, one failure model, one ops story |
| 5 | Kafka: local engine / AWS home / schema / delivery | **KRaft Apache Kafka ×3 locally** · **Strimzi operator on EKS** · **JSON + AsyncAPI first** (Schema Registry at first schema break) · **outbox poller first**, Debezium CDC = stretch |
| 6 | Shared Redis or per-service? | **One cluster, namespace-per-service** (`vote:*`, `identity:*`) |
| 7 | k8s manifests or Helm from day 1? | **Helm** (env values are the point) |
| 8 | Client scope | **3 pages only** (event, leaderboard, checkout) |
| 9 | Timeline | **≈55 days** = 42 build + Explain gates (recommended) · deep 60–75 · compressed = stop at a tier boundary |
| 10 | MongoDB for analytics: keep or PG-only? | **Keep** — append-heavy feed + aggregation pipelines (ADR-0006 justifies); CV-listed skill |
| 11 | Internal service-to-service auth | **K8s NetworkPolicy + audience-restricted JWT** (no mesh); mTLS/Linkerd = stretch |
| **G-C** | Load provenance (A3) | **Local/kind = regression deltas only**; all absolute numbers (knee RPS, p95, res/s) come from Phase 9 EKS runs. `docs/capacity.md` gets a `source:` field per row (`kind-local` / `eks`). |
| **G-D** | Sustained load vs quota (A4) | **Fresh `event_id` per k6 run** (quota is per event/day → resets); seed factory mints the event + user cohort. Documented in `seed/README`; re-vote unique constraint still enforced per run. |
| **G-E** | SSE owner (A5) | **vote service** serves `GET /api/v1/v1/events/{id}/stream` (leaderboard is its data); fallback = 1 s polling. If gateway buffering fights SSE, ship polling-first and make SSE the stretch. AsyncAPI/SSR implications noted in ADR-0001. |
| **G-F** | HPA custom RPS metric (A6) | **CPU-only HPA** by default; adding the custom RPS metric = **KEDA** (declarative in Helm, +0.5 day). Stretch, not a gate. |
| **G-H** | Migration tooling for NestJS (B3) | **node-pg-migrate** (plain SQL, pairs with `migrate-test` target); alternatives TypeORM migrations / Prisma — decide with G-H answer, applied identically to identity + vote. |
| **G-I** | Version pins (C6) | Pin exact versions on day one and verify each exists: Spring Boot **4.1.x**, NestJS **11**, Next.js **15** (16 is current by plan date — decide pin deliberately, don't drift), kind node **v1.34.2**, Kong-or-whatever per G-A. |

---

## Phase 0 — Decisions, contracts, scaffold (3 days)

**Objective:** every later phase cites frozen decisions; the seam exists before code.

### Task 0.1 Answer the 52 questions once
- Create `docs/decisions.md` — Q-01…Q-52 each: **Decision** + one-line why.
  These are frozen requirements; later phases cite them, never re-debate.
- Add the product-rules table above as the summary header.
- **Done when:** 52/52 answered; no "TBD" entries.

### Task 0.2 Resolve all decision gates → ADR-0007 (gateway auth) + ADR updates
- Record G-A…I answers in `docs/decisions.md` appendix "Decision gates".
- Create `docs/adr/0007-gateway-jwt-verification.md` — chosen gateway, JWKS
  fetch/rotation behavior, what the edge does vs what services do (pre-filter
  vs authoritative check), and the rejected alternatives (Kong OSS static keys,
  custom plugin, BFF).
- **Done when:** G-A through G-I have answers; ADR-0007 merged.

### Task 0.3 ADR set (the design voice of the repo)
- Create `docs/adr/0001-service-boundaries.md` (context map + why 4 not 12;
  when we WOULD split; SSE owner per G-E), `0002-contracts-first.md` (polyglot
  seam rules + server-conformance rule B2), `0003-integration-outbox-kafka.md`
  (no sync money calls, no dual-writes), `0004-data-per-service.md`,
  `0005-k8s-local-first-eks-later.md`, `0006-store-selection-v2.md`
  (Dynamo dropped; Mongo justification; Redis namespace-per-service).
- **Done when:** 7 ADRs exist; each ≤ 2 pages.

### Task 0.4 Contracts before code
- Create the 4 OpenAPI files + `asyncapi.yaml` with event schemas
  (`vote.cast`, `order.held`, `payment.captured`, `payment.failed`,
  `ticket.confirmed`, `notification.requested`).
- Create `contracts/event-ownership.md` — one row per event: producer,
  consumers, delivery guarantee, retry + DLQ topic, plus the **truth map**
  (vote owns vote truth · commerce owns order+payment truth · identity owns
  auth identity · analytics owns projections only). CI cross-checks rows
  against `asyncapi.yaml` (≥1 producer AND ≥1 consumer per message).
- Validate: `npx @stoplight/spectral lint contracts/**/*.yaml` → 0 errors.
- **Compatibility:** `oasdiff breaking` vs `contracts/baseline/` (C-fix: commit
  the initial baseline in this task — first PR can't diff against an empty
  `main`); newly-required request fields / removed fields / changed types FAIL
  CI; same evolution check for AsyncAPI; consumer tests validate real payloads.
- **Done when:** `make contract` green locally.

### Task 0.5 Repo scaffold
- Init git in `eventista2/`; layout per above; root `Makefile` with targets
  `help | install | up | lint | test | contract | e2e | migrate-test | load |
  web-lighthouse | chaos | kind-up | deploy-kind | smoke`.
- Each service ships `/healthz` + `/readyz` + `/metrics` and NOTHING else.
- `docker-compose.yml` (full: pg-vote=PostGIS, pg-commerce, redis, mongo,
  kafka ×3 KRaft) **and** `docker-compose.ci.yml` (1 broker, no Jaeger) — B4.
- **Done when:** all four skeletons build as images.

### Task 0.6 Version pin verification (C6)
- Lock exact versions in each service manifest; one-line proof in
  `docs/decisions.md` that Spring Boot 4.1.x parent, Boot 4 starter names
  (`webmvc`, split `-test`, `spring-boot-starter-flyway` +
  `flyway-database-postgresql`), Nest 11, Next 15, kind node 1.34.2 all resolve.
- **Done when:** a dependency install of each stack succeeds with pinned versions.

### Task 0.7 Migration tooling decision (G-H) wired into Makefile
- `make migrate-test` skeleton (fresh init · upgrade-from-previous ·
  expand-contract) — real bodies land with the first schema (Task 2.9 / 3.6),
  but the target and directory conventions exist now.
- **Done when:** `make migrate-test` exists and no-ops cleanly on empty schemas.

### Task 0.8 CI (B4, B7)
- `.github/workflows/ci.yml`: matrix job per service (lint + test + build
  image) · contract lint + oasdiff vs baseline · kind e2e job (slim compose
  profile) · security: Trivy image scan + CodeQL (B7) · Lighthouse job added
  in Phase 5.5.
- **Done when:** CI green on the skeleton PR.

**Phase 0 gate:** `make lint && make contract && make test` green on all four
skeletons, CI green. **Explain gate:** defend service boundaries + gateway
choice (record in `docs/learning/`).

---

## Phase 1 — Walking skeleton (3 days) ★prove the platform before the domains

**Objective:** one request traces gateway → all services → response, and one
real event flows through Kafka — before any domain depth.

### Task 1.1 kind cluster
- Create `deploy/helm/kind-config.yaml` — 1 control + 2 workers.
- **Pitfall (verified):** `kind create --image kindest/node:v1.34.2` —
  Docker Desktop's cgroup v1 hard-refuses k8s ≥ 1.35.
- **Done when:** `make kind-up` yields a Ready 3-node cluster.

### Task 1.2 Gateway → services end-to-end
- Create `deploy/helm/eventista/` per G-A: one route per service, rate-limit
  plugin, JWT plugin with **remote JWKS** from identity's JWKS URL (or
  documented G-A behavior).
- Wire: compose datastores + `make deploy-kind` (kind loads images, helm
  install).
- Create `load/k6/smoke.js` — 10 RPS through gateway to every service.
- **Done when:** `make smoke` passes against kind.

### Task 1.3 Mock IdP / dev token issuer (A2)
- Minimal issuer inside identity (or a `testsupport/` stub): RS256 keys on
  boot, JWKS endpoint, `test` mode that mints tokens without the OAuth dance.
  Phase 4 replaces the dance, keeps the JWKS contract.
- **Done when:** gateway accepts a mock-issued token, rejects a forged one.

### Task 1.4 Tracing from day one
- OTel SDK per service (Nest SDK, Spring actuator+otel, FastAPI
  opentelemetry-instrument) → Jaeger; `traceparent` propagated through gateway
  and Kafka record headers; correlation id + traceparent in structured JSON
  logs (pino/logback/structlog) in AND out.
- **Gate:** one k6 request = ONE trace spanning gateway→service→DB;
  `make e2e` = smoke + trace assertion.

### Task 1.5 Prove the async path in the skeleton too
- ONE real event end-to-end: vote stub → outbox → Kafka `vote.cast` →
  analytics stub writes a doc — asserted in `make e2e` (appears < 1 s).
- Why here: Kafka integration risk must surface in Phase 1, not Phase 5.

### Task 1.6 Observability fundamentals = "service done" definition
- Every service, from here on: structured logs · correlation id propagation ·
  RED metrics · error classification (4xx / 5xx / typed-503 taxonomy per
  ground rule 8). Phase 8 operationalizes; it never introduces the fundamentals.
- **Done when:** `/metrics` exposes request counters + latency histograms on
  all four services.

**Commit:** `feat: walking skeleton` (sync + async + telemetry).
**Phase 1 gate:** `make e2e` green (smoke + trace + async doc < 1 s).
**Explain gate:** trace a request across 3 languages + the bus; defend why
mock IdP ≠ shortcut.

---

## Phase 2 — Vote context (the crown jewel, rebuilt clean) (5.5 days)

**Objective:** correct-by-construction voting with value-level proof + the
PostGIS event catalog.

### Task 2.1 Seed / test-data factory (B1)
- Create `seed/` — CLI to mint users (OAuth-ready), events (with PostGIS
  points, HCMC + Tokyo), ticket inventory (Phase 3 hooks in), and **fresh
  event + user cohort per k6 run** (G-D).
- **Done when:** `make seed` populates local stack; k6 run script can mint a
  run-scoped event id.

### Task 2.2 Domain first
- Create `services/voting/src/domain/ballot.ts` — pure aggregate: quota
  window, point bounds, re-vote rejection; **unit tests FIRST** (no I/O).
- `application/cast-vote.handler.ts` — use-case orchestration;
  `infrastructure/` — pg repository, redis Lua guard, outbox writer.
- **Done when:** domain unit tests green with 100% branch coverage on quota
  and re-vote rules.

### Task 2.3 The correctness layers (v1 lessons, fewer stores)
- Redis sliding window (gateway) → Redis Lua `cast_vote.lua` (SET NX + quota +
  counter, 1 RTT) → PG `UNIQUE (event_id, user_id)` final backstop.
- Leaderboard: SET-index + MGET (never SCAN — the v1 6.26 s trap), namespace
  split voter vs candidate counters (v1 key-prefix bug).
- **Done when:** layers individually unit-testable; backstop proven by a test
  that bypasses Redis deliberately.

### Task 2.4 Prove it
- `services/voting/test/voting.e2e-spec.ts` — 500 concurrent votes → accepted
  == 1; **values** asserted (leaderboard == ledger).
- k6: `load/k6/vote-ramp.js` with G-D event-per-run design → knee recorded in
  `docs/capacity.md` **with `source: kind-local`** (G-C).
- **Done when:** e2e invariant test green; capacity row recorded with source.

### Task 2.5 Event catalog with PostGIS (the CV's GIS claim, made real)
- Migration: `events.location geography(Point,4326)` + GIST index; seed venue
  points.
- Create `GET /api/v1/events/near?lat&lon&radius_km` — ONE query:
  `ST_DWithin` + `ST_Distance` ORDER BY; documented in `contracts/openapi/vote.yaml`;
  no N+1, no app-side distance math.
- Test: radius filter + distance ordering correct; `EXPLAIN` asserts an
  **Index Scan using a GIST index**, never a Seq Scan.
- Infra: vote PG container runs `postgis/postgis`; Phase 9 RDS enables `postgis`.
- **Done when:** near-query e2e green incl. EXPLAIN assertion.

### Task 2.6 SSE live leaderboard (G-E)
- Create `GET /api/v1/events/{id}/stream` (SSE) in vote, behind the gateway;
  if gateway buffering/rate-limit fights long-lived connections → document the
  fallback (1 s polling) and open the SSE stretch note in ADR-0001.
- **Done when:** client receives ≥ 2 pushed updates in a test; OR ADR records
  polling-first decision with evidence.

### Task 2.7 Contract conformance harness (B2)
- Build the reusable e2e assertion: every HTTP response validated against
  `contracts/openapi/vote.yaml` (response schema + status codes) — spectral
  lints the spec, this lints the implementation.
- **Done when:** conformance runs in `make e2e` for vote; required for commerce
  (3.6), identity (4.3), analytics (5.2).

### Task 2.8 Event ownership + async publish
- Vote publishes `vote.cast` via outbox (same relay pattern commerce will
  reuse); `contracts/event-ownership.md` row for `vote.cast` validated by CI.
- **Done when:** consumer test sees `vote.cast` payload matching AsyncAPI.

### Task 2.9 Migrations (G-H applied)
- First real schema + `make migrate-test`: fresh init · upgrade-from-previous
  · expand-contract safe under rolling deploy.
- **Done when:** `make migrate-test` green for vote DB.

**Phase 2 gate:** `make lint && make test && make contract && make e2e &&
make load` green. **Explain gate:** defend the three correctness layers and
the SCAN trap (STAR story #2 seeded in `docs/learning/database-concurrency.md`).

---

## Phase 3 — Commerce: ticketing + payments (Spring Boot 4) (5 days)

**Objective:** correct order/payment state machine, outbox-only money moves,
an explicit and tested saga.

### Task 3.1 Service skeleton done RIGHT (your own Java gotchas)
- Spring Initializr → **pom parent `4.1.2` (not `.RELEASE`)**; Boot 4 starter
  renames (`webmvc`, split `-test`); Flyway =
  `spring-boot-starter-flyway` + `flyway-database-postgresql`; run with
  `-Duser.timezone=UTC`; `unset tmp` before `spring-boot:run` on this box.
- **Done when:** `make -C services/commerce lint test` green.

### Task 3.2 Aggregates & state machine
- `Order` (JPA `@Version`, states `HELD → AWAITING_PAYMENT → SOLD | RELEASED`),
  `Payment` (one per order), `TicketInventory` with optimistic/fair locking —
  **lock seat rows in stable order, never the drop row** (v1 R-14: that
  serialised checkout to ~10/s).
- Invariants: DB `CHECK` + unique constraints are final backstop.
- Event-config rule honored: `event_id` opaque, inventory created via seed/admin.
- **Done when:** unit tests cover every allowed/forbidden transition.

### Task 3.3 Money moves only via outbox
- Outbox table + relay (`UPDATE…RETURNING` claim — NOT commit-then-send, v1
  D-03) → Kafka topics (partition key = order id → per-order ordering);
  at-least-once + idempotent consumers; DLQ *topic* after 10 attempts (v1 D-16);
  webhook signature over **raw bytes** (v1 D-02); circuit breaker + bulkhead
  on the PSP client (v1 R-19).
- Mock PSP in `services/commerce/testsupport/` with `FAULT_RATE` injection.
- **Done when:** outbox relay unit tests + webhook raw-bytes test green.

### Task 3.4 Payment saga — explicit, documented, tested
- ADR `docs/adr/0008-payment-saga.md`: order `HELD → AWAITING_PAYMENT → SOLD |
  RELEASED` **plus** payment `INITIATED → CAPTURED | FAILED | REFUNDED`, with:
  - capture OK but response timeout / crash before local update → order stays
    `AWAITING_PAYMENT` → **reconciliation is the recovery**, scheduled
    (EventBridge → `run-task reconcile` in Phase 9) — never operator memory;
  - inventory expires mid-payment and capture lands after expiry →
    compensation = auto-refund OR documented refusal + alert — pick one in
    `docs/decisions.md`;
  - `payment.failed` / saga timeout → release inventory **in the same tx**;
  - ticket confirmation fails after capture → outbox retries, never a 2nd charge.
- Every transition recorded: allowed/forbidden, timeout, compensation.
- **Acceptance tests:** (a) provider SUCCESS + local FAILED → scheduled
  reconciliation converges with ZERO manual repair; (b) **migration tests**
  (Task 3.6).

### Task 3.5 Prove it
- Tests: 50 concurrent last-seat checkouts → sold == 1; webhook ×10 →
  effect ×1; breaker opens under 100% gateway failure and checkout degrades typed.
- k6: `load/k6/hot-drop.js` → ≥ 300 res/s recorded in `docs/capacity.md`
  (source field per G-C).
- Contract conformance (B2, harness from 2.7) applied to commerce e2e.

### Task 3.6 Migrations for commerce (G-H + B3)
- `make migrate-test` for commerce DB: fresh · upgrade · expand-contract
  under rolling deploy (Flyway callbacks/versioned + repeatable).
- **Done when:** migrate-test green for both PG databases.

**Phase 3 gate:** `make lint && make test && make contract && make e2e &&
make migrate-test && make load` green. **Explain gate:** defend the saga
(timeouts, reconciliation, same-tx release) — STAR story #1 seeded in
`docs/learning/distributed-transactions.md`.

---

## Phase 4 — Identity + gateway policies (4 days)

**Objective:** v1's worst identity bugs never recur; edge vs service trust
boundary unambiguous.

### Task 4.1 Identity service
- OAuth2 auth-code + PKCE; RS256 with **JWKS endpoint served by the service**;
  opaque refresh tokens, rotation + family revocation; flow state in Redis;
  keys from AWS Secrets Manager in EKS (ephemeral-key fallback = boot FAILURE,
  not a warn — v1 R-06); dev keys from env in kind.
- Mock-IdP mode (Task 1.3) becomes the `test` profile — same signing path,
  no user interaction.
- Test: forged/unsigned token rejected; cross-instance login completes
  (2 pods, no stickiness — v1 R-18); refresh-token rotation + reuse revocation.
- **Done when:** identity e2e green incl. JWKS rotation test (old kid rejected
  after TTL, new kid accepted without restart).

### Task 4.2 Gateway as the edge
- Per-route rate limits (vote strict, analytics conservative — v1 R-04),
  JWT verify via remote JWKS per G-A, request IDs, WAF notes in ADR
  (Cloudflare = design, not code).
- Test: refresh flood hits the limit, not Postgres; `/metrics` not public.
- **Done when:** rate-limit + JWT tests green against kind.

### Task 4.3 Token verification architecture (unambiguous)
- **Edge:** gateway validates JWT signature/iss/aud as a cheap pre-filter — NOT
  the only check.
- **Services:** each verifies the JWT **locally** against a JWKS **cached
  in-process** (TTL + refresh-on-unknown-`kid`, rotation-safe) — zero identity
  calls on the hot path.
- **Zero trust:** services never honor identity headers supplied by a client;
  gateway-set headers accepted only from the gateway (NetworkPolicy), business
  permissions re-checked inside the service.
- **Service-to-service auth:** decision gate 11 (NetworkPolicy + audience JWT).
- Contract conformance applied to identity responses.
- **Done when:** a test proves a client-forged gateway header is ignored.

**Phase 4 gate:** full `make e2e` + `make load` with auth on every route.
**Explain gate:** defend edge-vs-service verification and header zero-trust —
`docs/learning/` security notes.

---

## Phase 5 — Analytics + notify (FastAPI) (3 days)

**Objective:** projections only, never truth; consumers that can't corrupt.

### Task 5.1 Consumers only — never the truth
- Consume `vote.cast` / `ticket.confirmed` from Kafka (consumer group
  `analytics`, manual commit after side-effect) → Mongo activity feed (history,
  votes-per-minute) → notify fan-out (email/push provider stub + template).
- **Idempotency (B6):** every handler dedupes on event id (unique index /
  upsert) — at-least-once must not produce duplicate activity docs.
- v1 D-08/09/10 in reverse: producer contracts exist FIRST (AsyncAPI) so a
  consumer with no producer cannot merge (CI: every message ≥1 producer AND
  ≥1 consumer) — plus one **consumer-driven verification**: analytics' test
  pulls the `ticket.confirmed` schema and commerce CI verifies its real payload
  against it (lightweight; no Pact broker until a third consumer exists).
- **Done when:** duplicate-delivery test proves single activity doc.

### Task 5.2 Prove it
- Test: vote in `vote` service → activity doc appears < 1 s end-to-end through
  the bus; poison message → DLQ, not a crash loop.
- Load: analytics endpoints under `mixed-event-night` stay p95 < 500 ms
  (source field per G-C).
- Contract conformance on analytics HTTP responses.
- **Done when:** e2e + DLQ test green.

**Phase 5 gate:** `make e2e` green including analytics assertions.
**Explain gate:** `docs/learning/kafka-delivery-semantics.md` — at-least-once,
idempotent consumers, DLQ policy, why analytics is never truth.

---

## Phase 5.5 — Fan client, Next.js 15 (~2 days)

**Objective:** close the CV's frontend claim (React/Next/TS + Web Vitals) and
give k6 a realistic journey.

### Task 5.5.1 Three pages, contract-typed
- `apps/web/` (App Router, TS): event page (vote button + quota state),
  live leaderboard (SSE per G-E, 1 s polling fallback), checkout
  (hold → pay → confirm). Talks ONLY to the gateway; types generated from
  `contracts/openapi/*.yaml` via `openapi-typescript` — client cannot drift.
- Event page composes vote-catalog + commerce-inventory calls (documented
  event-config rule); login = redirect to identity (mock mode in dev).
- Server components for reads; client components only where the fan interacts
  (SSR/hydration split = interview talking point).
- **Done when:** three pages functional against kind via gateway.

### Task 5.5.2 Lighthouse budget as a CI gate
- `@lhci/cli` in CI — **Performance ≥ 90, CLS < 0.1, LCP < 2.5 s** on all
  three routes; bundle budget route JS < 150 kB gzipped.
- **Stub mode (C4):** LHCI runs against a static export with fixture API data
  so the job is deterministic (live-stack Lighthouse flaps).
- **Done when:** `make web-lighthouse` green and CI job added.

### Task 5.5.3 Realistic load shape
- Rewrite `load/k6/mixed-event-night.js` to follow the client's real sequence
  (login → fetch event → vote → poll leaderboard → checkout) instead of raw
  endpoint calls; cohort + fresh event from `seed/` (G-D).
- **Gate:** `make web-lighthouse` green + full-flow k6 numbers in
  `docs/capacity.md`.

**Explain gate:** SSR vs client components, hydration boundary, typed-contract
client.

---

## Phase 6 — Resilience + chaos (4 days)

**Objective:** failure-mode docs become executable tests.

### Task 6.1 Failure semantics per dependency
- Timeouts / retry-with-jitter (idempotent only) / circuit breaker / bulkhead
  in all services; typed 503 envelope per ground rule 8; **no `process.exit`
  on datastore blip** — retry-with-backoff readiness (v1 R-17); boot never
  requires all datastores.
- **Done when:** per-service failure-injection unit tests green.

### Task 6.2 Chaos suite
- `load/chaos/{kill-vote-pod,redis-outage,pg-restart,kafka-broker-down}.sh`
  + `make chaos` — run MID-`make load`; assert: no 5xx storm (thresholds per
  ground rule 8), consumer lag drains on broker recovery, **no duplicate side
  effects** (idempotency under chaos — incl. analytics dedupe, B6), HPA
  replaces killed pods.
- **Gate:** `make chaos` green = Phase 6 exit.

**Explain gate:** `docs/learning/kubernetes-networking.md` + failure semantics
defense.

---

## Phase 7 — Kubernetes production mechanics (3 days)

### Task 7.1 Workloads
- Helm values per env; **HPA on CPU** (+ custom `k6`-derived RPS metric only
  if G-F chooses KEDA — stretch, not gate); PodDisruptionBudget
  (minAvailable 1); resource requests/limits sized from k6 data (not guesses);
  liveness/readiness probes → `/healthz`/`/readyz`; rollingUpdate
  `maxUnavailable=0`; Secrets via external-secrets (EKS) / literals (kind).
- **Done when:** manifests applied cleanly to kind.

### Task 7.2 Zero-downtime rollout proof
- `make deploy-kind && make smoke` — rollout proven by a k6 run at 200 RPS
  with 0 failed requests during the rollout.
- **Phase 7 gate:** rollout proof green.

---

## Phase 8 — Observability & SLOs (3 days)

### Task 8.1 Dashboards + SLO doc
- OTel → Prometheus + Grafana + Jaeger; RED dashboard **per service** + one
  "event night" pane (latency heatmap, consumer lag, DLQ depth, breaker state);
  `docs/slo.md` (vote p95 < 200 ms, 99.9% event-window availability, 0 oversell
  binary).

### Task 8.2 Alerts that are provable (v1 R-30 killed for good)
- `deploy/monitoring/alerts.yaml` where **every alert is fired once in
  `make chaos`**; metric hygiene: bounded labels only — no `event_id`, no
  `user_id` (v1 R-27).

### Task 8.3 Runbook
- `docs/runbook.md` — scale-up, DLQ drain, reconciliation schedule, incident paths.
- **Phase 8 gate:** dashboards render, every alert fired in a chaos run.

---

## Phase 9 — AWS: EKS lab, k6 proof, teardown (4 days)

> **Cloud boundary: I write the numbered command report; YOU run every command.**
> Region **ap-southeast-1** (Singapore) — ap-northeast-1 is full (11 VPCs,
> ServiceLimitExceeded). Never touch company VPCs.

### Task 9.1 Terraform (design → applied by you)
- `infra/terraform/`: ECR (4 images), EKS (eksctl or terraform-aws-modules,
  k8s 1.34), RDS PG Multi-AZ (2 DBs, `postgis` extension on vote DB),
  ElastiCache Redis, Kafka (Strimzi on EKS — or MSK, gate 5), Secrets Manager,
  ALB + Cloud Map. Ordered apply report + **`DELETE-PLAYBOOK.md` with full
  resource inventory BEFORE any apply** (your lab pattern).

### Task 9.2 Production-shaped proof (G-C: the only absolute numbers)
- Push images → ECR → Helm install → run `load/k6/event-night.js` + `soak.js`
  (30 min) + chaos at minute 20 **against the real cluster**.
- Capture: k6 JSON, Jaeger trace of a vote, HPA behavior, cost estimate →
  `docs/capacity.md` rows with `source: eks` (overwrites kind-local rows).

### Task 9.3 Teardown (same day)
- You run the delete playbook; I verify: `aws eks describe-cluster` → not
  found, zero leftover ELB/SG/NAT (in-tree controller makes CLASSIC ELBs —
  check `aws elb`, not elbv2). Record duration + total cost.
- **Phase 9 gate:** proofs captured, cluster deleted, cost recorded.

---

## Phase 10 — The artifact (2 days)

### Task 10.1 Report
- `docs/HIGH-TRAFFIC-REPORT.md` — before(v1)/after(v2) table: architecture
  diagram, knee RPS, p50/p95/p99 per service, checkout res/s, chaos results,
  cost; `README.md` headline; every capacity row cites its source (G-C) and
  notes payments are simulated (mock PSP).

### Task 10.2 Interview packaging
- **1 DA answer (`DA12 polyglot microservices rebuild`)**, 3 STAR stories
  (serialised checkout, SCAN trap, contract-first polyglot), CV bullet:
  "rebuilt as 4-service polyglot platform on EKS, proven at N RPS" — plus LHCI
  Lighthouse/CWV numbers as frontend evidence. Ground rule 1 ("I'd choose a
  modular monolith at day-job scale") stated in the DA answer.

**Phase 10 gate:** report + README complete; all `docs/learning/` and
`docs/reviews/` files present.

---

## How we work: the understanding loop (every significant change)

AI is teacher + reviewer, not just implementer. The artifact is only yours if
you can defend it:

1. **Understand** — AI explains the concept: why it exists, how it fails.
2. **Design** — YOU propose the approach FIRST, before reading generated code.
3. **Challenge** — AI red-teams it: what breaks, what at 10×, the alternative.
4. **Implement** — coding agent executes; you read every diff.
5. **Verify** — tests + one live experiment (not just green CI).
6. **Explain** — oral/written defense: why this · alternatives · failure
   behavior · limits · what changes at 10×. **No phase closes without it.**

**Learning-doc mapping (C7):**

| Phase | `docs/learning/` artifact |
|---|---|
| 0 | (boundary defense notes) |
| 1 | `observability.md` (traces/logs/metrics from day one) |
| 2 | `database-concurrency.md` (layers, unique backstop, SCAN trap) |
| 3 | `distributed-transactions.md` (outbox, saga, reconciliation) |
| 4 | security review → `docs/reviews/security-review.md` |
| 5 | `kafka-delivery-semantics.md` (at-least-once, idempotent consumers) |
| 5.5 | SSR/hydration + typed-contract notes |
| 6 | `kubernetes-networking.md` + failure semantics |
| 7–8 | `docs/reviews/architecture-review.md`, `performance-review.md` |
| 9–10 | capacity + cost defense |

`docs/reviews/{architecture,security,performance}-review.md` — one per relevant
phase; every learning doc ends with the 6-point Explain record.

---

## Risks & tradeoffs

| Risk | Mitigation |
|---|---|
| **Second-system effect** (rewrite forever) | Hard phase gates + walking skeleton in Phase 1 + 4-service cap; each phase ships a measurable artifact |
| Polyglot CI/maintenance tax | Matrix CI, contracts-only seam, 2 languages per dev zone not 5 |
| Kafka operational load | KRaft = no ZooKeeper; 3 brokers max; consumer-lag alert Phase 8; Strimzi only in Phase 9 lab |
| k8s learning curve swallows the project | kind-first (Phase 1), EKS last (Phase 9), delete playbook before create |
| Cost / orphaned AWS resources | Same-day teardown, playbook verified, ap-southeast-1 only |
| Scope ("full product") | Product rules frozen in Phase 0; anything outside the 4 contexts + 3 client pages is v3 |
| Gateway choice wrong for JWKS (A1) | G-A resolved in Phase 0 with ADR-0007 before any routing code |
| Capacity numbers incomparable (A3) | G-C: `source:` field per row; absolute numbers only from Phase 9 |
| Local machine resource limits | 16–24 GB floor stated; CI slim profile (B4) |
| Interview honesty | You can defend: "when I'd choose monolith" (ground rule 1) |
| **AI-assembled code you can't defend** | Understanding loop + per-phase Explain gate: no phase closes without YOUR oral defense recorded in `docs/learning/` |

## Validation gates (per phase — lazy/cumulative per ground rule 7)

```bash
# Phase 0+
make lint && make test        # per-service unit (jest/junit/pytest)
make contract                 # spectral + oasdiff breaking-change gate vs contracts/baseline/
# Phase 1+
make e2e                      # kind + full stack + trace assertion + async doc < 1s
# Phase 2+
make load                     # k6 vs the phase's target (relative numbers locally, G-C)
# Phase 3+
make migrate-test             # fresh init, upgrade, expand-contract (both PG DBs)
# Phase 5.5+
make web-lighthouse           # LHCI perf ≥ 90, CLS < 0.1 (stub mode, C4)
# Phase 6+
make chaos                    # failure modes executable; every alert fired by Phase 8
```

## Execution order

**Priority tiers** (if time compresses, stop at a tier boundary and still own
a defensible artifact):

| Tier | Phases | Outcome |
|---|---|---|
| **P0** | 0, 1, 2, 3 | correct, load-proven core (vote + commerce) + full platform skeleton |
| **P1** | 4, 5, 5.5, 6 | complete product: security, client, chaos-proven |
| **P2** | 7, 8, 9, 10 | k8s production mechanics, ops maturity, AWS proof, report |

Order: `0 → 1 → 2 → 3 → 4 → 5 → 5.5 → 6 → 7 → 8 → 9 → 10`.

**Timeline (gate 9):** ≈42 **build** days (phase day counts sum 41.5) with AI
assistance · **≈55 days** with the per-phase Explain gate (recommended) ·
60–75 deep variant. Understanding is the deliverable — the extra days buy
*defense*, not code. Phase day counts exclude the Explain gate.

Old plan (`plans/2026-10-31-high-traffic-refactor.md` in the parent workspace)
stays as the v1 hardening alternative — this v2 plan SUPERSEDES it if you
commit to the rebuild.
