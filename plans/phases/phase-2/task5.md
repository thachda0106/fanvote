# Task 2.5 — Event catalog with PostGIS

**Phase:** 2 · **ID:** T2.5 · **Depends on:** T2.1 · **The CV GIS claim, made real**

## Objective

One spatial query, index-backed, no N+1, no app-side distance math.

## Subtasks

- [ ] Migration: `events.location geography(Point,4326)` + GIST index
      (vote DB container = `postgis/postgis`; Phase 9 RDS enables the
      `postgis` extension).
- [ ] Seed venue points (HCMC + Tokyo) via T2.1 `--venues`.
- [ ] Create `GET /api/v1/events/near?lat&lon&radius_km`:
  - ONE query: `ST_DWithin(location, $1, radius_km)` filter +
    `ST_Distance(location, $1) ORDER BY` + limit/pagination;
  - parameter validation (lat/lon bounds, radius cap) → typed 400;
  - documented in `contracts/openapi/vote.yaml` (request + response + errors).
- [ ] Tests:
  - e2e: radius filter excludes out-of-range venues; results ordered by
    ascending distance (assert exact order on seeded fixture);
  - **EXPLAIN assertion**: run `EXPLAIN` on the query plan, assert
    `Index Scan using ...gist` present and `Seq Scan` absent — fails the test
    if the index is dropped or the planner goes sequential.
- [ ] No N+1: response built from the single query (test: query counter == 1
      per request via pg logging hook or pg_stat check).

## Done when

- near-query e2e green incl. EXPLAIN + query-count assertions; contract
  updated and `make contract` green.

## Verification

```bash
make e2e   # includes near-query + EXPLAIN assertions
```
