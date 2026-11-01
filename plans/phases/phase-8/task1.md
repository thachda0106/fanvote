# Task 8.1 — Dashboards + SLO doc

**Phase:** 8 · **ID:** T8.1 · **Depends on:** T1.6 metrics

## Objective

One RED view per service + one "event night" pane, and SLOs written as
numbers the alerts actually use.

## Subtasks

- [ ] OTel → Prometheus + Grafana + Jaeger stack as Helm values
      (`deploy/helm/eventista/` or observability subchart).
- [ ] **RED dashboard per service**: rate (RPS by route+class), errors
      (4xx/5xx/typed-503 split), duration (p50/p95/p99 heatmap).
- [ ] **"Event night" pane**: vote latency heatmap, checkout res/s, consumer
      lag (Kafka), DLQ depth, outbox backlog, breaker states, HPA replicas.
- [ ] `docs/slo.md`: **vote p95 < 200 ms**, **99.9% availability in the event
      window**, **0 oversell = binary invariant** (not an SLO — a correctness
      gate), error-budget math, and which alerts consume which signal.
- [ ] Metric hygiene audit: **bounded labels only — no `event_id`, no
      `user_id`** (v1 R-27); audit script or review checklist in the dashboard
      repo.

## Done when

- Dashboards render live data in kind; `docs/slo.md` numbers match alert
  thresholds; hygiene audit passes.

## Verification

```bash
make deploy-kind   # Grafana reachable; panels populated by smoke traffic
```
