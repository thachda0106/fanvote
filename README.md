# eventista v2 — polyglot microservices rebuild

Greenfield rebuild of the Eventista fan-engagement product: **4 services +
Envoy Gateway + thin Next.js client**, contracts-only seam, Kafka outbox
integration, kind-first Kubernetes, k6-proven, Terraform-to-EKS.

- **Plan:** `plans/2026-10-31-v2-microservices-rebuild.md` (v2.1)
- **Frozen decisions:** `docs/decisions.md` (Q-01…Q-52 + decision gates G-A…G-I)
- **ADRs:** `docs/adr/0001…0007` — boundaries, contracts, outbox/Kafka, data,
  k8s local-first, store selection, gateway JWT
- **Contracts (the seam):** `contracts/openapi/*.yaml` + `contracts/asyncapi.yaml`
  + `contracts/event-ownership.md` (+ `contracts/baseline/` for oasdiff)

v1 (`eventista-clone/`) remains the **requirements oracle**, not code to copy.

## Hardware floor

Docker Desktop / WSL2 with **≥ 16 GB RAM (24 GB preferred)** — full profile
runs 2 PG + PostGIS + Redis + Mongo + Kafka ×3 + Jaeger + 4 services.
CI uses the slim profile (`docker-compose.ci.yml`: 1 broker, no Jaeger).

## Commands (`make help` lists all)

```bash
make install      # deps: contract tooling + 4 services
make lint         # spectral + eslint + mvn compile + ruff
make test         # jest + mvn test + pytest
make contract     # spectral + ownership + oasdiff breaking + asyncapi gate
make up           # full compose stack (datastores + skeletons)
make migrate-test # migration suites (no-op until Phase 2/3 schemas)
```

Lazy gates (plan ground rule 7): `make e2e` from Phase 1, `make load` from
Phase 2, `make chaos` from Phase 6 — stubs print their start phase.

## Required status checks (before merge)

All jobs below are required by branch protection on `main`:

- `contract (spectral + ownership + oasdiff + asyncapi)`
- `identity (lint + test + image)`
- `voting (lint + test + image)`
- `commerce (lint + test + image)`
- `analytics (lint + test + image)`
- `migrate-test (stub — real from Phase 2)`
- `kind e2e stack (slim compose — B4)`
- `security (trivy + codeql — B7)`

## Status

**Phase 0 (this scaffold):** decisions frozen, 7 ADRs, contracts linted +
breaking-change gated, four service images with `/healthz` `/readyz`
`/metrics` only, per-service CI. Next: Phase 1 walking skeleton.

## Toolchain notes (Windows host)

- `make` via scoop (`~/scoop/shims`), GNU Make 4.4.1
- JDK 21 at `%JAVA_HOME%` for Spring Boot 4 (PATH `java` may be older — Maven
  uses `JAVA_HOME`)
- Host Postgres grabs `:5432` → compose remaps 55432/55433, Redis 56379,
  Mongo 57017, identity 3011; Kafka host ports **19092–19094** (this box already runs other
  projects on 9092/9093 — geotrack redpanda + kafka-1; do not stop them)
- kind must pin `kindest/node:v1.34.2` (cgroup v1 refuses k8s ≥ 1.35) — Phase 1
