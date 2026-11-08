# Phase 1 — walking skeleton

The platform proof for eventista2: **one traced request** through Envoy Gateway →
four polyglot services → datastore, and **one real event** vote → outbox →
Kafka → analytics. Domain logic is deliberately stubbed; the seams, contracts,
observability, and failure modes are real.

## Actors and triggers

| Actor | Trigger | Outcome |
|---|---|---|
| Fan / k6 / curl | `POST /api/v1/votes/events/{id}/votes` with a bearer token | 201 + ballot stub row + outbox row in one PG tx |
| Analytics consumer | `eventista.vote.cast` record | idempotent Mongo activity doc (same trace id) |
| Operator | `make kind-up / deploy-kind / e2e` | cluster + release + phase gate |
| Dev | `POST /api/v1/identity/auth/test-token` (AUTH_MODE=test) | RS256 token signed like the future IdP |

## Components

- **identity** (NestJS, 3001) — mock IdP: boot-time RS256 keypair, JWKS,
  test-token, `/users/me`; local verifier for its own guard.
- **voting** (NestJS, 3002) — vote stub, transactional outbox, relay,
  local JWT verification, catalog/leaderboard stubs.
- **commerce** (Spring Boot, 8081) — DB-less inventory stub, JSON logs,
  Prometheus registry, OTel Java agent.
- **analytics** (FastAPI, 8001) — `vote.cast` consumer, Mongo activity feed,
  votes-per-minute aggregation, readiness reflects Mongo + consumer.
- **Envoy Gateway v1.9.3** — Gateway API routes, optional JWT pre-filter,
  local rate limits, OTLP tracing.
- **collector + Jaeger** in kind; **Postgres/Mongo/Kafka** in compose,
  reached via `host.docker.internal`.

## Entry points

- Gateway: `http://localhost:8080/api/v1/{identity|votes|commerce|analytics}/...`
  rewritten to backend contract paths (`/api/v1/...`).
- Gate: `make e2e` (= `make smoke` + `scripts/e2e.sh`).
- Ops: `make kind-up`, `make kind-load`, `make deploy-kind`, `make token`.

## Key sources

- Gateway/policies: `deploy/helm/eventista/templates/gateway.yaml`,
  `.../policies.yaml`, `.../services.yaml`, `values-kind.yaml`.
- Sync path: `services/voting/src/vote/vote.controller.ts`,
  `services/voting/src/auth/jwt-verifier.service.ts`.
- Async path: `services/voting/src/outbox/outbox.relay.ts`,
  `services/analytics/app/consumers/vote_cast.py`.
- Analytics reads: `services/analytics/app/main.py`.
- Gate: `scripts/e2e.sh`, `load/k6/smoke.js`.
- Explain material: `docs/learning/observability.md`;
  decisions: `docs/decisions.md` § Phase 1.

## Status

Gate green on `kindest/node:v1.34.2` (2026-11-08): `make smoke` 112/112 checks,
`make e2e` PASS (doc 250–840 ms, full trace). Version pins are G-I-frozen.
