# Task 0.5 — Repo scaffold

**Phase:** 0 · **ID:** T0.5 · **Depends on:** T0.4 · **Kills B4**

## Objective

Skeleton repo where every service builds as an image and exposes only
observability endpoints.

## Subtasks

- [x] `git init` in `eventista2/` (G-B: final name decided here, never again).
- [x] Directory layout per plan: `contracts/ services/{identity,voting,commerce,
      analytics}/ apps/web/ seed/ deploy/helm/ infra/terraform/ load/{k6,chaos}/
      docs/{adr,learning,reviews}/`.
- [x] Root `Makefile`: `help | install | up | lint | test | contract | e2e |
      migrate-test | load | web-lighthouse | chaos | kind-up | deploy-kind | smoke`
      (`make help` lists all with one-line descriptions).
- [x] Each service ships **only** `/healthz` (liveness, datastore-independent),
      `/readyz` (503 when degraded — v1 D-12), `/metrics` (RED) + structured
      JSON logs with correlation id.
- [x] `docker-compose.yml` (full local): pg-vote = `postgis/postgis`,
      pg-commerce, redis, mongo, kafka ×3 KRaft, jaeger.
- [x] `docker-compose.ci.yml` (slim CI): 1 Kafka broker, no Jaeger — review
      finding B4 (GH runner 7 GB).
- [x] Service Dockerfiles (multi-stage) + `make lint/test` wired per stack
      (jest, maven/gradle, pytest).
- [x] Document local hardware floor in README: Docker Desktop/WSL2 ≥ 16 GB
      (24 GB preferred).

## Done when

- All four service images build; `make up && make smoke-hello` starts datastores;
  health endpoints respond on each container.

## Verification

```bash
make install && make lint && make test   # green on four skeletons
docker compose up -d && curl /healthz /readyz /metrics on each service
```
