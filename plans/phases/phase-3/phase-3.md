# Phase 3 — Commerce: ticketing + payments (Spring Boot 4)

**Days:** 5 · **Tier:** P0 (last) · **Order position:** 4th

**Objective:** correct order/payment state machine; money moves ONLY via
outbox; an explicit, documented, tested payment saga — no oversell, no double
charge, ever.

**Depends on:** Phase 2 gate; G-H (migrations), T2.7 harness, event-config
rule (ADR-0001: `event_id` opaque).

## Tasks

| # | Task | ID |
|---|---|---|
| 1 | Service skeleton done RIGHT (Boot 4 gotchas) | T3.1 |
| 2 | Aggregates & state machine | T3.2 |
| 3 | Money moves only via outbox | T3.3 |
| 4 | Payment saga — explicit, documented, tested | T3.4 |
| 5 | Prove it (last-seat, webhook ×10, breaker, hot-drop) | T3.5 |
| 6 | Migrations for commerce DB | T3.6 |

## Phase gate

```bash
make lint && make test && make contract && make e2e && make migrate-test && make load
```

## Explain gate

Defend the saga: every transition, timeout, compensation — including
"capture OK, local update lost → scheduled reconciliation converges with zero
manual repair". → `docs/learning/distributed-transactions.md`
(STAR story #1 seeded here).
