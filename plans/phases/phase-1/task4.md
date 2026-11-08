# Task 1.4 — Tracing from day one

**Phase:** 1 · **ID:** T1.4 · **Depends on:** T1.2

## Objective

One k6 request = ONE trace spanning gateway → service → DB, from Phase 1
onward — tracing is never retrofitted.

## Subtasks

- [x] OTel SDK per service:
  - NestJS: `@opentelemetry/sdk-node` (auto-instrument HTTP + pg/ioredis);
  - Spring Boot: actuator + OTel Java agent;
  - FastAPI: `opentelemetry-instrument` (uvicorn + pymongo + kafka).
- [x] Collector → Jaeger via Helm chart in `deploy/helm/eventista/` (or
      observability subchart).
- [x] **Propagation:** `traceparent` through gateway headers AND Kafka record
      headers (producer sets, consumer reads) — async spans join the trace.
- [x] Correlation id: `X-Request-Id` accepted/generated at edge, present in
      every structured log line in AND out of each service.
- [x] Create `load/k6/smoke.js` assertions unchanged; add trace assertion to
      `make e2e`: query Jaeger API for the trace id from one k6 run and assert
      ≥ gateway span + ≥1 service span + ≥1 DB span.
- [x] Kafka async assertion: `vote.cast` consumer span has the same trace id
      as the producing request (W3C `traceparent` in record headers).

## Done when

- `make e2e` = smoke + trace assertion green (sync span chain + async linkage).

## Verification

```bash
make e2e   # fails if Jaeger has no matching trace or DB span missing
```
