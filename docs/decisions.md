# docs/decisions.md — frozen requirements (eventista v2)

> **Phase 0 · Task T0.1.** Source: `eventista-clone/docs/project-overview/22-unknown-and-open-questions.md`
> (Q-01…Q-52). These are frozen: later phases **cite by Q-ID**, never re-debate.
> Every entry = **Decision** + one-line why + the phase that consumes it as
> acceptance criteria. Zero TBD.

## Product rules (summary header — overrides the v1 defaults)

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
| Load data provenance | Local/kind = relative regression only; absolute numbers only from Phase 9 EKS (G-C) | C-A3, Q-52 |
| Auth in Phases 1–3 | Mock IdP (dev token issuer) ships in Phase 1; real identity in Phase 4 | C-A2, Q-38 |
| Sustained load vs quota | Each load run creates a **fresh event id** → quota window resets per run (G-D) | C-A4, Q-51 |

---

## 1. Codebase questions

### Q-01 — Why was the anti-abuse scorer built but never wired in?
**Decision:** Not rebuilt. v2's only anti-abuse controls are the gateway edge rate-limit and the Redis quota Lua — both wired and tested in the same PR that ships them; no control may be documented as active before a caller exists.
**Why:** D-08/R-03 — v1 shipped a fully-tested scorer with zero callers and a dead alert.
**Consumed by:** Phase 2 (wired layers), Phase 4 (edge limits).

### Q-02 — Where is the fan-activity document supposed to be written?
**Decision:** Analytics writes it, consuming `vote.cast` from Kafka (at-least-once, deduped on event id) — never inline in the vote path, never a sync call.
**Why:** vote latency stays independent of Mongo; the feed is a rebuildable projection (D-09).
**Consumed by:** Phase 5 (T5.1).

### Q-03 — Where should the ticket notification be published from?
**Decision:** Commerce publishes `ticket.confirmed` from the order/payment outbox in the same transaction as the state change; analytics consumes it and emits `notification.requested`. No producer lives in a webhook handler.
**Why:** D-10 — producer must sit with the truth (order state), one bus (Kafka), no dormant RabbitMQ path.
**Consumed by:** Phase 3 (T3.3), Phase 5 (T5.1).

### Q-04 — Was the `id_token` verification ever implemented?
**Decision:** Every JWT (id_token or access token) is JWKS-verified — signature, iss, aud, exp — including tokens from the mock IdP (RS256). The unverified base64-decode path does not exist in v2.
**Why:** D-01/R-01 — the single most severe v1 defect; auth bypass.
**Consumed by:** Phase 1 (T1.3 mock signs), Phase 4 (T4.1).

### Q-05 — Why are the `flows` (OAuth state) in memory?
**Decision:** OAuth flow state lives in Redis with a 10-minute TTL, keyed by state param; no per-process maps, no ALB stickiness assumed.
**Why:** D-11/R-18 — login must complete on any replica (desired_count ≥ 2).
**Consumed by:** Phase 4 (T4.1).

### Q-06 — What is the intended reading source for the leaderboard?
**Decision:** Default read = Redis counters (latency path); Postgres ledger = truth. An invariant test asserts counter == ledger as **values**; ops escape hatch reads the ledger directly. Runbook states: counters serve, ledger rules.
**Why:** resolves DD-05/R-08 (doc said ledger, code read Redis); counters are a cache, not truth.
**Consumed by:** Phase 2 (T2.3, T2.4).

### Q-07 — Which quota semantics are correct?
**Decision:** 10 points per event per day (GMT+7 day boundary), enforced at ONE point: the Redis Lua script, with the PG ledger as durable backstop. Two clocks (24 h TTL vs 00:00 GMT+7) are forbidden.
**Why:** D-35/R-10 — dual enforcement points disagreed about resets.
**Consumed by:** Phase 2 (T2.2, T2.3).

### Q-08 — Why is the dedupe TTL a constant 86 400?
**Decision:** Redis re-vote marker TTL = time until `event.voting_closes_at` + 1 h margin (derived, not hard-coded); the PG `UNIQUE (event_id, user_id)` is the durable backstop so TTL expiry cannot create a second vote.
**Why:** D-34 — fixed 86 400 blocked late voters for 24 h and lied about its own name.
**Consumed by:** Phase 2 (T2.3).

### Q-09 — Is the `SKIP LOCKED` + advisory lock combination intentional?
**Decision:** Neither. The outbox relay claims rows by **marking them in-tx** (`UPDATE … SET claimed_at, attempts+1 … RETURNING`) and publishes only claimed rows — no session advisory locks (pool-unsafe, D-04), no commit-then-send (D-03). At-least-once + idempotent consumers.
**Why:** D-03/D-04/R-15 — both protections were false; claim-then-send is the honest contract.
**Consumed by:** Phase 0 (ADR-0003), Phase 3 (T3.3), Phase 2 (T2.8).

### Q-10 — Why does the `payments` table have two uniqueness rules?
**Decision:** ONE rule: `UNIQUE (order_id)` — one payment attempt-of-record per order. A second attempt with a different key returns 409 `PAYMENT_STATE_CONFLICT` (or the existing payment), never an unhandled 23505 → 500.
**Why:** D-05/R-16 — unhandled constraint violation on legitimate client retry.
**Consumed by:** Phase 3 (T3.2).

### Q-11 — Should the `Idempotency-Key` be scoped per user?
**Decision:** Yes — `UNIQUE (user_id, idempotency_key)` on both orders and payments; lookup always filters by user; missing/malformed header → 400 `VALIDATION_FAILED`.
**Why:** D-06/D-07 — global key = cross-user payment disclosure; missing header = 500.
**Consumed by:** Phase 3 (T3.2, T3.3).

### Q-12 — Is `idempotency_keys` meant to be implemented?
**Decision:** No generic table. Idempotency is expressed per aggregate as scoped unique constraints handled explicitly in the service layer; the two-phase `state` column design is dropped.
**Why:** D-19 — a write-only design nobody implemented; explicit constraints are testable.
**Consumed by:** Phase 3 (T3.2).

### Q-13 — Is `leaderboard_snapshots` meant to be read?
**Decision:** Not rebuilt. Leaderboard = Redis counters (default) or live PG ledger query; no snapshot table, no materialised copy.
**Why:** write-only in v1 and redundant with the ledger read path.
**Consumed by:** Phase 2 (T2.3).

### Q-14 — Was a `role`/`admin` surface ever planned?
**Decision:** No admin HTTP surface in v2 (client scope = 3 pages). Events, candidates and inventory are created via the `seed/` CLI only; RolesGuard-equivalent is not shipped until routes exist.
**Why:** D-17 — a guard with no route is dead code; scope cap (4 contexts + 3 pages = v2).
**Consumed by:** Phase 2 (T2.1 seed), scope rule for all phases.

### Q-15 — What is the intended `APPLY`-level behaviour of `users.status`?
**Decision:** Not modeled. Identity has no suspended/deleted states in v2; if moderation arrives (v3), it ships as an identity-issued claim + enforcement in the same change.
**Why:** D-18 — never ship a column nothing reads.
**Consumed by:** Phase 4 (schema).

### Q-16 — Which of the two reconciliation implementations is canonical?
**Decision:** ONE implementation: the commerce reconciliation service method. The scheduled job (EventBridge → run-task, Phase 9) and any CLI wrapper call that same method — no parallel logic.
**Why:** D-21 — two divergent implementations (CLI also marked seats sold).
**Consumed by:** Phase 3 (T3.4), Phase 9 (schedule).

### Q-17 — Is the 5xx metric gap known?
**Decision:** 5xx counters and latency histograms record on the **error path** (finalize/error branch) on every service from Phase 1; the error-rate alert must fire during `make chaos`.
**Why:** D-14/R-30 — v1's primary alert could never fire; ground rule 8.
**Consumed by:** Phase 1 (T1.6), Phase 6/8 (alert provability).

### Q-18 — Why is `is_free` on `votes`?
**Decision:** Paid votes are out of scope. Votes are free-only within the 10-point quota; no `is_free` column, no paid-vote purchase flow (v3 if ever).
**Why:** D-38 — modeling an unimplemented product creates misleading schema.
**Consumed by:** Phase 2 (schema).

### Q-19 — Should `PAYMENT_CURRENCY` exist?
**Decision:** No global currency env. Currency is a field on the ticket-inventory record, copied at inventory-creation time (event-config rule: commerce never syncs to vote).
**Why:** D-36 — dead knob; inventory is the local source of price/currency truth.
**Consumed by:** Phase 3 (T3.2), Phase 2 (T2.1 seed).

### Q-20 — Should `REFRESH_REUSE_GRACE_SEC` do anything?
**Decision:** No grace window. Refresh-token reuse → immediate family revocation (strict), full stop; the env knob does not exist.
**Why:** grace windows re-open the stolen-token race; strict is the only behavior we test.
**Consumed by:** Phase 4 (T4.1).

### Q-21 — Where is `docs/adr/0008-iac-safety.md`?
**Decision:** v2 numbering: **ADR-0008 = payment saga** (Task 3.4). The IaC-safety content v1 cited (delete playbook before apply, validate-only locally) lives in **ADR-0005** (k8s local-first, EKS later) — every referenced ADR must exist.
**Why:** DD-01 — never cite an ADR you didn't write.
**Consumed by:** Phase 0 (T0.3), Phase 3 (T3.4).

### Q-22 — What are the intended rate limits for the non-vote endpoints?
**Decision:** Gateway enforces per-route limits on ALL routes: vote strict, auth/refresh strict (flood must hit the gateway, not Postgres), analytics conservative; `/metrics` and `/healthz` are never exposed through the gateway.
**Why:** R-04 — v1 rate-limited only the vote path; refresh flood and expensive aggregations were open.
**Consumed by:** Phase 1 (T1.2), Phase 4 (T4.2).

### Q-23 — Is the `multer` dependency a leftover?
**Decision:** Leftover — no upload feature exists; `multer` (and every other unused v1 dep) is not in any v2 manifest.
**Why:** D-43 — unused deps = unused CVE surface.
**Consumed by:** Phase 5 (dependency audit), enforced by `make lint`/audit in CI.

### Q-24 — What was the `meaningless-load-test.js` for?
**Decision:** Not ported. Everything under `load/k6/` is a real scenario wired to `make load`; no anti-pattern teaching scripts ship in the repo runnable.
**Why:** a deliberate anti-pattern must never be one `make` away from a real stack.
**Consumed by:** Phase 2 (T2.4), Phase 0 (scaffold).

---

## 2. Business questions

### Q-25 — Who owns the "Eventista" product?
**Decision:** Fictionalized portfolio product inspired by 1VOTE/1ZONE-style fan engagement; product flavor kept: `Asia/Ho_Chi_Minh` (GMT+7) quota days, VND prices. No real product owner — the plan's product-rules table is the authority.
**Why:** honesty about what this artifact is; timezone/currency are deliberate flavor, not integrations.
**Consumed by:** Phase 0 (this doc), Phase 2 (quota clock).

### Q-26 — What is the actual free-vote product rule?
**Decision:** A fan may allocate **10 free points per event per GMT+7 day** (single cast 1…10 points, cumulative ≤ 10/day/event). One enforcement point (Redis Lua), PG ledger backstop.
**Why:** the only rule that satisfies both the Redis cap and the daily ledger without two clocks (with Q-07/R-10).
**Consumed by:** Phase 2 (T2.2, T2.3, T2.4).

### Q-27 — What happens when a fan wants to change their vote?
**Decision:** Re-vote not allowed. First cast wins; subsequent casts → 409 `RE_VOTE_NOT_ALLOWED`. `UNIQUE (event_id, user_id)` is the final backstop — no delete-and-reinsert path exists.
**Why:** one-ballot is the simplest provable invariant; the DB already enforces it.
**Consumed by:** Phase 2 (T2.2, T2.4).

### Q-28 — Is there a ticket issuance artefact?
**Decision:** Yes — commerce issues a `ticket` row (order id, seat/inventory ref, human-readable reference code) returned by the confirm API and displayed on the checkout page. No QR image pipeline in v2.
**Why:** "seat marked sold" is not an artefact; a reference code closes the gap without a rendering subsystem.
**Consumed by:** Phase 3 (T3.2), Phase 5.5 (checkout page).

### Q-29 — What is the refund policy?
**Decision:** Auto-refund via saga compensation: capture landing after inventory expiry → immediate refund (`payment.refunded` event) + alert; never operator-memory refunds. Manual/refund-for-cause is out of scope.
**Why:** R-20/Q-29 — v1 refused to auto-refund and had no scheduled reconciliation; convergence must be automatic (plan T3.4).
**Consumed by:** Phase 3 (T3.4).

### Q-30 — Is there a purchase limit per fan?
**Decision:** Yes — `max_tickets_per_user` on the ticket-inventory record (default 2), enforced on hold AND buy. One fan cannot buy out a drop.
**Why:** Q-30/R-14 context — a bot with one session could purchase every seat in v1.
**Consumed by:** Phase 3 (T3.2).

### Q-31 — What is the anti-scalping policy?
**Decision:** Per-fan purchase cap + gateway edge rate-limit only. No device fingerprinting, no payment-method fingerprinting in v2.
**Why:** fingerprinting is a v3 product call; the cap is the enforceable minimum without a new subsystem.
**Consumed by:** Phase 3 (T3.2), Phase 4 (T4.2).

### Q-32 — What is the "event scheduler"?
**Decision:** No custom scheduler component. Pre-event scale-up = k8s HPA (CPU-only per G-F) + documented manual pre-scale in the runbook (`kubectl scale` / Helm values before event night).
**Why:** G-F default — KEDA/RPS metric is stretch; v1's phantom "event scheduler" owned nothing.
**Consumed by:** Phase 7 (T7.1), Phase 8 (runbook).

### Q-33 — Is `CAPTCHA_ENABLED` supposed to integrate with a real provider?
**Decision:** No CAPTCHA in v2 — no challenge branch, no `CAPTCHA_REQUIRED` code. Abuse controls = edge rate-limit + quota layers only.
**Why:** D-08 — v1 shipped an unreachable error code with no client contract.
**Consumed by:** Phase 4 (T4.2).

### Q-34 — What is the notification provider and its template?
**Decision:** Provider behind an interface; default = stub (log/fixture sink) in dev/test; template = ticket confirmation (event name, order reference, total). Real provider = one config swap, same interface — not built in v2.
**Why:** the deliverable is the fan-out path (`notification.requested` → delivery), not a vendor integration.
**Consumed by:** Phase 5 (T5.1).

---

## 3. Infrastructure questions

### Q-35 — Is the Terraform meant to be brought to a deployable state?
**Decision:** Yes — v2's `infra/terraform/` is written to be **applied in Phase 9 only**, by the user, as a numbered command report, region ap-southeast-1, with `DELETE-PLAYBOOK.md` (full resource inventory) committed BEFORE any apply. Local review = `terraform validate` only.
**Why:** C5/cloud rule — v1's 13-gap design artifact must not be repeated; never `terraform apply` from an agent.
**Consumed by:** Phase 9 (T9.1).

### Q-36 — Where do the secrets come from in production?
**Decision:** AWS Secrets Manager + external-secrets operator on EKS; kind uses literals/env. Missing JWT signing keys in prod = **boot FAILURE**, not a warn; ephemeral-key fallback exists only in `test`/`dev` profiles.
**Why:** R-06 — v1 generated per-task keypairs and silently broke multi-replica login.
**Consumed by:** Phase 4 (T4.1), Phase 9 (T9.1).

### Q-37 — Is a WAF actually deployed?
**Decision:** No WAF code or Terraform in v2. Edge protection = gateway rate-limit + JWT pre-filter; Cloudflare remains a documented design note (ADR-0001/0007) — no "gateway guard" claims without code.
**Why:** R-04/Q-37 — v1's ADR assigned rate limiting to an edge that didn't exist.
**Consumed by:** Phase 4 (T4.2), ADR set.

### Q-38 — Which IdP, in which region, with which JWKS?
**Decision:** Identity **is** the IdP: OAuth2 auth-code + PKCE, RS256, JWKS endpoint served by the identity service (no Google/Apple/Facebook). Mock-IdP mode = `test` profile with the same signing path (Phase 1), real flow in Phase 4.
**Why:** removes external-IdP config from scope while keeping the JWKS contract identical (C-A2, D-01).
**Consumed by:** Phase 1 (T1.3), Phase 4 (T4.1).

### Q-39 — Which PSP, and what is its webhook contract?
**Decision:** No real PSP. Commerce talks to a PSP **adapter interface**; mock PSP in `services/commerce/testsupport/` with `FAULT_RATE` injection; webhook signature verified over **raw request bytes** (D-02). Report states payments are simulated.
**Why:** portfolio honesty — a fake VNPay/MoMo contract would be the D-02 bug with better marketing.
**Consumed by:** Phase 3 (T3.3), Phase 10 (report note).

### Q-40 — Is MongoDB's production home DocumentDB or self-hosted?
**Decision:** Self-hosted Mongo StatefulSet on EKS (dies with the Phase 9 cluster); compose container locally. DocumentDB not used — aggregation compatibility risk + a managed resource outliving a same-day lab.
**Why:** same-day create/delete teardown must leave zero orphans; one ops story (container) across kind and EKS.
**Consumed by:** Phase 9 (T9.1), ADR-0006.

### Q-41 — Is RabbitMQ's production home self-hosted, AWS MQ, or something else?
**Decision:** RabbitMQ is gone (decision gate 4). Kafka is the only bus: KRaft ×3 locally, Strimzi on EKS. No SQS, no second broker.
**Why:** one bus, one failure model, one ops story — v1 ran Rabbit (notify) + SQS (payments) and both were unprovisioned.
**Consumed by:** Phase 0 (gates), ADR-0003/0006.

### Q-42 — What is the on-call rota and the incident tooling?
**Decision:** No real rota — portfolio artifact. Alerting = Prometheus rules in `deploy/monitoring/alerts.yaml`, **every alert fired once in `make chaos`**; `docs/runbook.md` documents incident paths a hypothetical on-call would follow.
**Why:** R-30 — v1's alerts were inoperative; provable alerts > imaginary pagerduty.
**Consumed by:** Phase 6 (T6.2), Phase 8 (T8.2, T8.3).

### Q-43 — What are the RTO and RPO for the ledger?
**Decision:** Phase 9 RDS = Multi-AZ + 7-day backup + PITR enabled → lab-shape **RPO ≈ 5 min, RTO ≈ 15 min**, documented in `docs/capacity.md`/runbook. No cross-region DR (out of scope). Pod termination loses **zero** committed data (SLO, always).
**Why:** bounded, testable numbers instead of v1's unstated "7-day backups, no PITR, no RTO".
**Consumed by:** Phase 9 (T9.1), Phase 8 (runbook).

### Q-44 — Who owns the mock IdP and the mock gateway in production?
**Decision:** Mocks are in-repo test doubles, never deployed. Mock IdP → identity's `test` profile (same JWKS/signing path, replaced by real OAuth flow in Phase 4). Mock PSP → **permanent** by explicit product scope (payments simulated, Q-39); its "production stand-in" is itself, documented.
**Why:** v1 mocks were never deployed with no stand-in; v2 names what actually runs.
**Consumed by:** Phase 1 (T1.3), Phase 3 (T3.3).

---

## 4. Operational questions

### Q-45 — How is the reconciliation actually scheduled?
**Decision:** Scheduled, never manual: k8s CronJob in Helm (kind) → EventBridge → `run-task reconcile` on EKS (Phase 9), both calling the single commerce reconciliation method (Q-16). Cadence: every 5 minutes.
**Why:** R-32 — "nightly manual make" means stuck payments stay stuck forever.
**Consumed by:** Phase 3 (T3.4 logic), Phase 9 (T9.1 schedule).

### Q-46 — Who drains the DLQs, and how often?
**Decision:** DLQ = Kafka `<source>.dlq` topic after 10 failed attempts (D-16). Depth alert fires in `make chaos`; drain = per-consumer reprocess command documented in `docs/runbook.md`; DLQ depth is a dashboard panel. Ownership: the consuming service's team (analytics for projections, commerce for payment events).
**Why:** D-26/Q-46 — v1's drain was a no-op referencing a missing script; growing DLQ silently stops confirmations.
**Consumed by:** Phase 5 (T5.1), Phase 6 (T6.2), Phase 8 (T8.2).

### Q-47 — What is the log aggregation and the retention?
**Decision:** Structured JSON logs (pino/logback/structlog) to stdout with correlation id + traceparent; local/kind = `kubectl logs`/compose; traces = Jaeger, metrics = Prometheus. No hosted log backend (Loki/CloudWatch agent) in v2 — trace-id search lives in Jaeger.
**Why:** three pillars are traces + metrics + structured stdout; a log backend without an ops story is shelfware.
**Consumed by:** Phase 1 (T1.4), Phase 8 (dashboards).

### Q-48 — Is there a session-affinity setting on the ALB?
**Decision:** No affinity anywhere. OAuth state in Redis (Q-05) removes the premise; gateway (Envoy Gateway/APISIX per G-A) routes statelessly.
**Why:** D-11 fix makes stickiness unnecessary — never paper over per-process state with routing tricks.
**Consumed by:** Phase 4 (T4.1, T4.2).

### Q-49 — What is the database migration procedure for a real deployment?
**Decision:** Migrations run as a **pre-deploy job**: `make migrate-test` locally/CI; on k8s a Helm pre-upgrade hook (or init job) applies migrations before new pods pass readiness. Tooling: node-pg-migrate (identity, vote) + Flyway (commerce) per G-H. No compose-only one-shot.
**Why:** Q-49 — v1 had a compose migrate container and nothing in Terraform; rolling deploy needs an ordered gate.
**Consumed by:** Phase 0 (T0.7 conventions), Phase 2 (T2.9), Phase 3 (T3.6).

### Q-50 — What is the data-retention policy?
**Decision:** (1) expired refresh tokens purged by a daily job; (2) `webhook_events`/`outbox_events` retained 30 days then deleted; (3) votes/orders/payments/tickets kept for the lab lifetime — and **votes are never cascade-deleted with a user** (user deletion anonymizes identity linkage, never mutates tallies).
**Why:** R-12/D-47 unbounded growth + v1's cascade-delete-would-change-an-election hazard.
**Consumed by:** Phase 8 (runbook), enforced where jobs land (Phase 8/9); rule binding now.

### Q-51 — What is the expected peak profile per event?
**Decision:** The SLO **is** the peak profile: 10,000 concurrent voters · 2,000 RPS vote path · p95 < 200 ms · checkout ≥ 300 res/s · chaos survival. Seed-factory defaults: 5,000 seats/event, 24 h voting window, fresh event id per k6 run (G-D).
**Why:** for a portfolio artifact the load targets are the product spec; seat/window defaults make runs reproducible.
**Consumed by:** Phase 2 (T2.1, T2.4), Phase 3 (T3.5), Phase 9 (absolute proof).

### Q-52 — Is the k6 load test ever run against a production-shaped environment?
**Decision:** Yes — Phase 9 runs k6 (event-night, soak, chaos-at-minute-20) against the real EKS cluster. Local/kind runs are recorded as **relative regression only**, every `docs/capacity.md` row carries `source: kind-local | eks`, and only `eks` rows are absolute capacity claims.
**Why:** C-A3/G-C — v1's committed report was local-stack numbers presented as SLOs.
**Consumed by:** Phase 2 (first rows), Phase 9 (T9.2).

---

## Appendix A — D-/R- ID cross-check (plan → v1 docs)

Every defect/risk ID cited by the v2 plan exists in the v1 oracle
(`17-legacy-and-technical-debt.md`, `18-architecture-risks.md`):

| ID | Confirmed | ID | Confirmed | ID | Confirmed |
|---|---|---|---|---|---|
| D-01 | ✓ | D-12 | ✓ | R-06 | ✓ |
| D-02 | ✓ | D-14 | ✓ | R-10 | ✓ |
| D-03 | ✓ | D-16 | ✓ | R-14 | ✓ |
| D-06 | ✓ | D-21 | ✓ | R-17 | ✓ |
| D-07 | ✓ | D-35 | ✓ | R-18 | ✓ |
| D-08 | ✓ | D-38 | ✓ | R-19 | ✓ |
| D-09 | ✓ | D-43 | ✓ | R-27 | ✓ |
| D-10 | ✓ | R-04 | ✓ | R-30 | ✓ |
| D-11 | ✓ | | | | |

## Appendix B — Decision gates (resolved, Task T0.2)

All gates answered — nothing remains on "default if silent". Cloud gates are
marked **user-runs**: every Terraform/EKS write op is a numbered command
report executed by the user (plan ground rule 6).

| # | Question | Answer (frozen) |
|---|---|---|
| **G-A** | Gateway + JWKS verification | **Envoy Gateway** (OSS). `SecurityPolicy` JWT provider with `remoteJWKS.uri` pointed at identity's JWKS URL, `issuer` + `audiences` set; JWKS cached by Envoy and refreshed on interval / unknown `kid`. Edge = cheap pre-filter; services still verify locally (ADR-0007). Rejected: Kong OSS `jwt` (static per-consumer keys), Kong `openid-connect` (Enterprise), custom Kong plugin (+2 days), thin NestJS BFF. |
| 2 | Gateway vs thin NestJS BFF | Real OSS gateway (Envoy Gateway) — a home-made proxy reads junior in interviews. |
| 3 | DynamoDB in v2? | **Drop** — PG `UNIQUE` index is the backstop; 4 datastores → 3. |
| 4 | RabbitMQ? | **Gone** — Kafka only: one bus, one failure model, one ops story. |
| 5 | Kafka: local / AWS / schema / delivery | **KRaft Apache Kafka ×3 locally** · **Strimzi operator on EKS** · **JSON + AsyncAPI first** (Schema Registry at first schema break) · **outbox poller first** (Debezium CDC = stretch). |
| 6 | Shared Redis or per-service? | **One cluster, namespace-per-service** (`vote:*`, `identity:*`, `commerce:*`, `analytics:*`). |
| 7 | k8s manifests or Helm? | **Helm from day 1** (`deploy/helm/eventista`) — env values are the point. |
| 8 | Client scope | **3 pages only**: event, leaderboard, checkout. Anything else = v3. |
| 9 | Timeline | **≈55 days** (42 build + per-phase Explain gates) — recommended; deep 60–75; compressed = stop at a tier boundary. |
| 10 | MongoDB for analytics | **Keep** — append-heavy feed + aggregation pipelines (ADR-0006); CV-listed skill. |
| 11 | Internal service-to-service auth | **K8s NetworkPolicy + audience-restricted JWT** (no mesh); mTLS/Linkerd = stretch. |
| **G-B** | Repo name + location | Keep directory **`eventista2/`** as the repo root (created); v1 stays the requirements oracle. Rename to `eventista-v2` only before first push — **decided: no rename, `eventista2` is final**. |
| **G-C** | Load provenance | Local/kind = **relative regression deltas only**; absolute numbers (knee RPS, p95, res/s) only from Phase 9 EKS runs. Every `docs/capacity.md` row has `source: kind-local \| eks`. |
| **G-D** | Sustained load vs quota | **Fresh `event_id` per k6 run** (quota is per event/day → resets); seed factory mints event + user cohort; re-vote unique constraint still enforced per run. |
| **G-E** | SSE owner | **vote service** serves `GET /api/v1/events/{id}/stream` (it owns leaderboard data); fallback = 1 s polling. If the Envoy Gateway buffers/fights SSE → ship polling-first, SSE becomes stretch (noted in ADR-0001). |
| **G-F** | HPA custom RPS metric | **CPU-only HPA** by default; custom RPS metric via **KEDA** = stretch (+0.5 day, declarative in Helm), not a gate. |
| **G-H** | Migration tooling (NestJS) | **node-pg-migrate** (plain SQL) for identity + vote; **Flyway** for commerce (`spring-boot-starter-flyway` + `flyway-database-postgresql`). Applied identically to both Nest services (T0.7). |
| **G-I** | Version pins | Exact pins day one, each verified to resolve: Spring Boot **4.1.x** parent `4.1.2`, NestJS **11**, Next.js **15** (deliberate over 16), kind node **v1.34.2** (cgroup v1 refuses k8s ≥ 1.35), Envoy Gateway release **v1.9.3** (chart version pinned at T1.2 install). Proof lines in § Version pins. |

**Cloud gate (standing rule):** any `terraform apply` / EKS write op = numbered
command report **run by the user**, region ap-southeast-1, delete playbook
committed first (Q-35, ADR-0005). Local kind/docker work needs no permission.

### Version pins (T0.6 — one-line proof per stack; no `^`/`latest`)

| Component | Pin | Proof |
|---|---|---|
| Spring Boot parent | `4.1.2` (a `4.1.x`, NOT `.RELEASE`) | `mvn dependency:resolve` OK; `4.1.0` and `4.1.2` POMs HTTP 200 on Maven Central |
| Boot 4 starter renames | `spring-boot-starter-webmvc` · `spring-boot-starter-webmvc-test` | both POMs HTTP 200 @4.1.2; `@AutoConfigureMockMvc` found in `spring-boot-webmvc-test-4.1.2.jar` (`org.springframework.boot.webmvc.test.autoconfigure`) — test suite green with it |
| Flyway (first used T3.6) | `spring-boot-starter-flyway` + `org.flywaydb:flyway-database-postgresql` | starter POM HTTP 200 @4.1.2; `flyway-database-postgresql` resolves from Maven Central (latest listed) |
| NestJS | `11.2.8` (`common`/`core`/`platform-express`), cli `11.0.24`, schematics `11.1.0` | `npm install` OK in identity+voting; `npm run lint && npm test` green (3/3 each) |
| TS toolchain | typescript `5.9.3`, eslint `9.39.5`, typescript-eslint `8.72.1`, jest `29.7.0`, ts-jest `29.4.15` | resolved on install; lint+test green both Nest services |
| Next.js | `15.5.28` (G-I: deliberate 15, not 16) | `npm view next@15` → 15.5.28; app code lands Phase 5.5 |
| FastAPI stack | fastapi `0.162.0`, uvicorn `0.54.0`, prometheus-client `0.26.0`, pydantic `2.14.2`, structlog `26.1.0` | `uv sync` OK; `uv run pytest` green (3 tests) |
| Python dev tools | pytest `9.2.0`, httpx `0.28.1`, ruff `0.17.3` | `uv run ruff check` + `pytest` green |
| kind node image | `kindest/node:v1.34.2` | cgroup-v1 hard-refuses k8s ≥ 1.35 on this box (verified pitfall, v1/plan) — applied in Phase 1 T1.1 |
| Envoy Gateway (G-A) | release **v1.9.3** (chart pin finalized at T1.2 install) | GitHub `envoyproxy/gateway` latest = v1.9.3 |
| oasdiff (contract gate) | `1.35.0` (`.tools/bin/oasdiff`, auto-fetched by `make tools`) | breaking gate run: pass on baseline==current, exit 1 on removed response field |
| Docker images | `node:22.23.4-alpine`, `maven:3.9.11-eclipse-temurin-21`, `eclipse-temurin:21-jre-alpine`, `python:3.12.12-slim`, `apache/kafka:3.8.0` | all pulled OK on this host; pinned in Dockerfiles/compose (bitnami/kafka **not** used — tags discontinued, switched to official apache/kafka) |

**Host gotchas confirmed:** `JAVA_HOME` → JDK 21 (Maven ignores older PATH
`java` 15); Boot 4 needs `@AutoConfigureMockMvc` (split test starter); GNU
Make 4.4.1 installed user-level (scoop) because the box had no `make`.