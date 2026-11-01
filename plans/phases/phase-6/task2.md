# Task 6.2 — Chaos suite (failure modes executable)

**Phase:** 6 · **ID:** T6.2 · **Depends on:** T6.1, `make load` running

## Objective

Run real failures MID-load and assert the system's promises hold.

## Subtasks

- [ ] `load/chaos/kill-vote-pod.sh` — delete a vote pod under 200 RPS:
      HPA/k8s replaces it; **0 client-visible 5xx storm** (ground rule 8
      thresholds; connection-reset window measured and documented).
- [ ] `load/chaos/redis-outage.sh` — Redis down under vote load: typed 503s
      or degraded path per T2.3 decision; no process exits; recovery without
      restart.
- [ ] `load/chaos/pg-restart.sh` — PG restart: readiness flips, backlog
      drains, no committed-data loss (write-ack'd rows survive).
- [ ] `load/chaos/kafka-broker-down.sh` — kill 1 of 3 brokers: **consumer lag
      drains on recovery**; outbox backlog drains; no message loss.
- [ ] Common assertions (in `make chaos`): no 5xx storm · **no duplicate side
      effects** (idempotency under chaos — vote accepted==1, order effect×1,
      analytics doc×1 — incl. B6 dedupe) · HPA replaces killed pods · every
      alert rule defined so far fires at least once (full sweep in Phase 8).
- [ ] `make chaos` = suite runner; documented as **Phase 6 exit gate** and
      re-run in Phase 9 against EKS.

## Done when

- `make chaos` green: all four scenarios pass with thresholds enforced.

## Verification

```bash
make load & make chaos   # scripts run mid-load; exit code gates the phase
```
