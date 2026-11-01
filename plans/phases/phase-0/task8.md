# Task 0.8 — CI pipeline (matrix, contract lint, slim compose, security)

**Phase:** 0 · **ID:** T0.8 · **Depends on:** T0.5, T0.4 · **Kills B4, B7**

## Objective

A green PR gate from day one that scales to all four languages without
OOM-ing on a 7 GB runner.

## Subtasks

- [x] `.github/workflows/ci.yml`:
  - **per-service jobs** (4 parallel jobs, matrix-equivalent): lint + unit
    test + build image (identity/voting = `npm ci && npm run lint && npm
    test`, commerce = maven, analytics = `uv sync && pytest`, web = added
    Phase 5.5);
  - **contract job**: spectral lint + oasdiff vs `contracts/baseline/` +
    AsyncAPI producer/consumer cross-check;
  - **kind e2e job**: uses `docker-compose.ci.yml` (1 broker, no Jaeger) —
    review finding B4;
  - **security jobs**: Trivy per-image scans (gating) + fs/config
    advisory + CodeQL JS/TS + Java + Python (review finding B7);
  - **migrate-test job** stub (real from Phase 2).
- [x] Path filters so docs-only PRs skip heavy jobs; concurrency cancel on
      superseding pushes.
- [x] Cache: npm/maven/uv layers keyed per lockfile.
- [x] Status checks documented in README (required before merge).

## Done when

- CI green on the scaffold PR; total wall time recorded (target < 15 min
  matrix, < 25 min with e2e).

## Verification

- Open a PR touching one service → only relevant jobs run; all required
  checks green.
