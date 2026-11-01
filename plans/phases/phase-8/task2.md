# Task 8.2 — Alerts that are provable (v1 R-30 killed for good)

**Phase:** 8 · **ID:** T8.2 · **Depends on:** T8.1, T6.2 · **v1 D-14, R-30**

## Objective

No dead alerts: every alert rule is fired once by a chaos scenario before the
phase closes.

## Subtasks

- [ ] `deploy/monitoring/alerts.yaml` — candidate set:
  - vote p95 > 200 ms for 5 min (SLO burn);
  - 5xx rate > threshold (typed `INTERNAL_ERROR` only — excludes
    `DEPENDENCY_UNAVAILABLE`, ground rule 8);
  - **consumer lag** growing (Kafka) — fires in `kafka-broker-down` chaos;
  - **DLQ depth > 0** — fires on poison-message chaos;
  - outbox backlog age > N s — fires in relay-stall scenario;
  - breaker open for > 1 min — fires in PSP-failure chaos;
  - readiness-failing pods > 0 for > 2 min — fires in `pg-restart`;
  - HPA at max replicas (saturation) — fires in ramp chaos.
- [ ] **5xx metrics recorded on the error path** (v1 D-14): verify counter
      increments inside exception handlers in all three stacks (test).
- [ ] Extend `make chaos` so **every rule above fires at least once** and the
      run records which scenario fired it; a rule with no scenario = deleted
      or given one (no dead rules).
- [ ] Alert routing/labels documented (severity, runbook link per alert).

## Done when

- `make chaos` green with the full alert-sweep: 8/8 (or documented set)
  rules observed firing.

## Verification

```bash
make chaos   # includes alert-fire assertions
```
