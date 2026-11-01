# Phase 2 — Vote context (the crown jewel, rebuilt clean)

**Days:** 5.5 · **Tier:** P0 · **Order position:** 3rd

**Objective:** correct-by-construction voting — pure domain first, three
defensibility layers, value-level proof (leaderboard == ledger) — plus the
PostGIS event catalog that makes the CV GIS claim real.

**Depends on:** Phase 1 gate green; G-D (fresh event per load run), G-E (SSE
owner), G-H (migration tooling).

## Tasks

| # | Task | ID |
|---|---|---|
| 1 | Seed / test-data factory (B1) | T2.1 |
| 2 | Domain first (pure aggregate, tests first) | T2.2 |
| 3 | The correctness layers (Lua + unique backstop) | T2.3 |
| 4 | Prove it (500 concurrent, values asserted, vote-ramp) | T2.4 |
| 5 | Event catalog with PostGIS (near query + EXPLAIN) | T2.5 |
| 6 | SSE live leaderboard (G-E) | T2.6 |
| 7 | Contract conformance harness (B2) | T2.7 |
| 8 | Event ownership + `vote.cast` publish | T2.8 |
| 9 | Migrations for vote DB (G-H) | T2.9 |

## Phase gate

```bash
make lint && make test && make contract && make e2e && make load
```

`make migrate-test` must be real (not no-op) for the vote DB from here on.

## Explain gate

Defend the three correctness layers (why each exists, what each alone fails
at) and the v1 SCAN trap. → `docs/learning/database-concurrency.md`
(STAR story #2 seeded here).
