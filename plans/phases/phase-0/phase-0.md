# Phase 0 — Decisions, contracts, scaffold

**Days:** 3 · **Tier:** P0 · **Order position:** 1st

**Status (2026-10-31):** all 8 tasks executed · local gate GREEN
(`make lint && make contract && make test` + `migrate-test` = 0) ·
4 images build · 12/12 health endpoints 200 · negative contract tests proven.
**Not closed:** (1) initial commit/push → CI green, (2) owner Explain defense.
Full evidence: [`result.md`](result.md).

**Objective:** every later phase cites frozen decisions; the seam (contracts)
exists before any domain code.

**Inputs:** v1 oracle (`eventista-clone/docs/project-overview/22-unknown-and-open-questions.md`,
`17-legacy-and-technical-debt.md`, `18-architecture-risks.md`), the v2.1 plan.

## Tasks

| # | Task | ID |
|---|---|---|
| 1 | Answer the 52 questions once | T0.1 |
| 2 | Resolve all decision gates → ADR-0007 | T0.2 |
| 3 | ADR set (0001–0006) | T0.3 |
| 4 | Contracts before code (OpenAPI + AsyncAPI + ownership) | T0.4 |
| 5 | Repo scaffold (Makefile, compose, health endpoints, images) | T0.5 |
| 6 | Version pin verification | T0.6 |
| 7 | Migration tooling decision wired into Makefile | T0.7 |
| 8 | CI (matrix, contract lint, slim compose, security scans) | T0.8 |

## Phase gate

```bash
make lint && make contract && make test   # green on all four skeletons; CI green
```

**Result:** local three-command gate green (2026-10-31); `make migrate-test`
green no-op; compose stack + image builds proven. CI leg pending first
push — see `result.md` § Close criteria.

`make e2e` starts Phase 1, `make load` Phase 2 — lazy gates (plan ground rule 7).

## Explain gate

Defend: service boundaries (why 4, not 12) + gateway/JWKS choice (G-A) with the
rejected alternatives. Record in `docs/learning/` before closing the phase.

**Result:** crib sheet prepared at
`docs/learning/phase-0-boundary-defense.md`; record table pending owner's
oral defense.
