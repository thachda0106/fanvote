# Task 6.1 — Failure semantics per dependency

**Phase:** 6 · **ID:** T6.1 · **Depends on:** T3.3 (breaker pattern), T1.6 ·
**v1 R-17, D-12**

## Objective

Every service degrades the same typed way under every dependency failure —
no process exits, no cascades, boot never needs all datastores.

## Subtasks

- [ ] Uniform helper per service (Nest/Spring/FastAPI): **timeout**, retry
      with **jitter** (idempotent operations only — never money/idempotency-
      unsafe retries), **circuit breaker**, **bulkhead** (bounded pools).
- [ ] Typed 503 envelope: `DEPENDENCY_UNAVAILABLE` + `retry-after` + dependency
      name (bounded label set) — part of the error taxonomy from T1.6.
- [ ] **No `process.exit` on datastore blip** (v1 R-17): readiness flips to
      503 while retry-with-backoff runs in background; liveness stays
      datastore-independent (v1 D-12).
- [ ] Boot: services start with any datastore down (degraded readiness), no
      migration/datastore gate at boot except their own DB when strictly
      needed — documented per service.
- [ ] Failure-injection unit tests per dependency (redis/pg/kafka/psp down →
      expected typed response + readiness state).

## Done when

- All three stacks' failure suites green; readiness/liveness behavior verified
  with a compose-level kill test.

## Verification

```bash
make test   # + docker compose stop redis|postgres → curl /readyz → 503, /healthz → 200
```
