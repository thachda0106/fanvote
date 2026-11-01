# Phase 8 — Observability & SLOs

**Days:** 3 · **Tier:** P2 · **Order position:** 10th

**Objective:** operationalize what Phases 1–6 introduced — dashboards, SLO
doc, alerts that are *provably* fireable, and a runbook. Nothing new is
introduced here.

**Depends on:** Phase 7 gate; every service exporting RED + error taxonomy
(T1.6).

## Tasks

| # | Task | ID |
|---|---|---|
| 1 | Dashboards + SLO doc | T8.1 |
| 2 | Alerts that are provable (R-30 killed) | T8.2 |
| 3 | Runbook | T8.3 |

## Phase gate

```bash
make chaos   # every alert in deploy/monitoring/alerts.yaml fires at least once
```

## Explain gate

`docs/reviews/architecture-review.md` + `performance-review.md`: SLO math
(error budget), alert signal choices (symptom vs cause), bounded-label rule.
