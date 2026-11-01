# Phase 0 — execution result

**Executed:** 2026-10-31 · **Reviewed:** 2026-11-01 · **Status:** local gate
GREEN · phase not yet closed (2 owner items pending — see § Close criteria)

## Gate

```text
make lint        → 0    (spectral 0 errors · eslint identity+voting · mvn compile · ruff)
make contract    → 0    (spectral · ownership cross-check · oasdiff --fail-on ERR ×4 · asyncapi gate)
make test        → 0    (jest 3/3 ×2 · surefire 3/3 · pytest 3/3)
make migrate-test→ 0    (no-op on empty schemas, T0.7)
```

Stack proof (T0.5 done-when):

- 4 images built: `eventista2-{identity,voting,commerce,analytics}`
- `docker compose up -d --wait`: healthchecks green (2 PG, Redis, Mongo,
  kafka-0); Jaeger, kafka-1/2, and the 4 service containers running
- 12/12 endpoints HTTP 200:
  `identity:3011` `voting:3002` `commerce:8081` `analytics:8001`
  × `/healthz` `/readyz` `/metrics`

## Per-task results

| Task | Result | Artifact |
|---|---|---|
| T0.1 | 52/52 answered, 0 TBD; product-rules header; per-Q phase tags; D-/R- cross-check | `docs/decisions.md` (App. A) |
| T0.2 | G-A…G-I + legacy 2–11 frozen; cloud ops marked user-runs; phase-1/T2 cites G-A directly | `docs/decisions.md` App. B · `docs/adr/0007-gateway-jwt-verification.md` |
| T0.3 | ADR set 0001–0007 complete, each ≤ 2 pages, gate refs, status Accepted | `docs/adr/0001…0007` |
| T0.4 | 4 OpenAPI skeletons + AsyncAPI 3.1 (6 channels, 12 ops) + ownership matrix + truth map + staged baseline (commit pending); negative tests: removed response field → oasdiff exit 1, removed payload prop → asyncapi gate exit 1 (both reverted) | `contracts/` · `scripts/check-ownership.mjs` · `scripts/asyncapi-breaking.mjs` |
| T0.5 | `git init` (main); Makefile 18 targets; compose full + ci (slim, B4); skeletons = health endpoints only; README w/ 16–24 GB floor | repo root |
| T0.6 | Pins proved (table below); Boot-4 gotchas verified live (`webmvc`, split `-test`, `@AutoConfigureMockMvc` package move); plan + G-I reconciled to 4.1.2; OTel pins deferred to T1.4; Envoy chart version at T1.2 | `docs/decisions.md` § Version pins |
| T0.7 | `make migrate-test` exists, exits 0 on empty schemas, fails if migrations appear while suites are still stubs; convention dirs created; CI stub calls it | `scripts/migrate-test.sh` |
| T0.8 | Workflow: 4 per-service jobs (lint/test/image) · contract job · slim-stack job · migrate-test stub · per-image Trivy (gating) + fs/config advisory + CodeQL JS/TS+Java+Python; path filters via `paths` not yet added (jobs run whole-repo — deferred note) | `.github/workflows/ci.yml` |

### Version pins (verified)

| Component | Pin |
|---|---|
| Spring Boot parent | `4.1.2` (4.1.x, not `.RELEASE`) |
| NestJS | `11.2.8` (cli `11.0.24`, schematics `11.1.0`) |
| TS toolchain | typescript `5.9.3`, eslint `9.39.5`, jest `29.7.0`, ts-jest `29.4.15` |
| Next.js | `15.5.28` (G-I: deliberate 15) |
| FastAPI stack | fastapi `0.162.0`, uvicorn `0.54.0`, prometheus-client `0.26.0` |
| OTel SDK (T1.4) | not pinned in Phase 0 — T1.4 adds the per-service SDK |
| Flyway (T3.6) | `spring-boot-starter-flyway` + `org.flywaydb:flyway-database-postgresql` (both resolve) |
| kind node | `kindest/node:v1.34.2` (cgroup v1 pin — applied T1.1) |
| Envoy Gateway | release `v1.9.3` (chart pin at T1.2) |
| oasdiff | `1.35.0` in `.tools/bin` (auto-fetched by `make tools`) |
| Images | `node:22.23.4-alpine` · `maven:3.9.11-eclipse-temurin-21` · `eclipse-temurin:21-jre-alpine` · `python:3.12.12-slim` · `apache/kafka:3.8.0` |

## Deviations from plan text (recorded, not re-opened)

1. **Compose PG naming:** plan said `pg-commerce`; ADR-0004 binds
   `pg-app` hosting logical DBs `commerce` + `identity` (2 PG instances
   total per plan's "PostgreSQL ×2"; vote = PostGIS instance alone).
2. **Kafka image:** `bitnami/kafka` tags discontinued → official
   `apache/kafka:3.8.0` (KRaft, dual INTERNAL/EXTERNAL listeners).
3. **Host port remaps (this box only):** Kafka `19092–19094` (9092/9093
   held by user's geotrack redpanda + kafka-1 — untouched); identity host
   `3011` (3001 held by user's geotrack-grafana — untouched); PG 55432/55433,
   Redis 56379, Mongo 57017 (Windows :5432 rule). CI compose/runner keeps
   clean-machine ports.
4. **Boot parent pin:** plan task text says `4.1.0`; pinned `4.1.2`
   (latest 4.1.x patch, both verified on Central). Plan § Tech stack and
   decisions G-I now read `4.1.2`.
5. **Toolchain bootstrap:** box had no `make` → installed GNU Make 4.4.1
   user-level via scoop; `JAVA_HOME` already JDK 21 (PATH `java` is 15 —
   Maven uses JAVA_HOME).
6. **T0.6 pin scope:** OTel SDK pins land with the tracing work in T1.4;
   Envoy Gateway release `v1.9.3` verified now, Helm chart version pinned
   at T1.2 install.

## Close criteria — remaining

| # | Item | Owner | Blocks close? |
|---|---|---|---|
| 1 | Initial commit + push → CI green; record wall time (target < 15 min per-service jobs, < 25 min with stack) (T0.8 done-when: "CI green on the skeleton PR") | user approval required (no-commit-without-ask rule) | yes |
| 2 | **Explain gate:** oral defense of boundaries (4-not-12) + G-A rejected alternatives; fill record table | owner | yes (plan: "no phase closes without it") |

Crib sheet: `docs/learning/phase-0-boundary-defense.md`.

**Next after close:** Phase 1 — walking skeleton (kind `v1.34.2`, Envoy
Gateway routes, mock IdP, OTel traces, first `vote.cast` e2e).