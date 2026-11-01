# Task 1.6 — Observability fundamentals = "service done" definition

**Phase:** 1 · **ID:** T1.6 · **Depends on:** T1.4 · **Plan rule: fundamentals
never introduced later, only operationalized in Phase 8**

## Objective

A checklist every service must satisfy from Phase 1 onward; Phase 8 only adds
dashboards/alerts on top.

## Subtasks

- [ ] **Structured JSON logs** — pino (Nest), logback JSON (Spring), structlog
      (FastAPI); fields: level, msg, correlation id, traceparent, service,
      route, status, duration_ms.
- [ ] **Correlation id + traceparent in AND out** (propagated to downstream
      calls and Kafka headers).
- [ ] **RED metrics** on `/metrics`: request count by route+status class,
      latency histogram, in-flight; Kafka: consumer lag, DLQ depth, outbox
      backlog gauges.
- [ ] **Error classification**: 4xx / 5xx / typed-503 (`DEPENDENCY_UNAVAILABLE`
      envelope) per ground rule 8 — a helper used by every service.
- [ ] `/metrics` NOT exposed through the gateway (edge blocklist) — verified
      in Phase 4 Task 4.2 but wired now.
- [ ] Add a CI lint: every service exposes `/healthz`, `/readyz`, `/metrics`
      (curl smoke in e2e).

## Done when

- All four services expose the three endpoints with real RED series; log lines
  from one request are joinable by correlation id across all three languages.

## Verification

```bash
make e2e   # includes endpoint smoke + scrape /metrics from Prometheus (if up)
```
