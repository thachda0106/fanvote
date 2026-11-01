# Task 3.3 — Money moves only via outbox

**Phase:** 3 · **ID:** T3.3 · **Depends on:** T3.2 · **v1 D-03, D-16, D-02, R-19**

## Objective

No commit-then-send, no dual-writes, no unsigned webhooks — the money path's
integration is provably at-least-once and idempotent.

## Subtasks

- [ ] Outbox table + relay using **`UPDATE…RETURNING` claim** (NOT
      commit-then-send — v1 D-03): claim row → publish → mark sent; crash
      between publish and mark → republish (at-least-once, consumers idempotent).
- [ ] Kafka topics with **partition key = order id** → per-order ordering
      (`order.held`, `payment.captured`, `payment.failed`, `ticket.confirmed`).
- [ ] Retry policy: exponential backoff with jitter; **DLQ topic after 10
      attempts** (v1 D-16) — DLQ depth gauge exported.
- [ ] Webhook (PSP callbacks): signature verified over **raw bytes captured in
      transport** (v1 D-02 — before JSON parsing), timestamp tolerance,
      replay-protection via delivery-id idempotency key.
- [ ] Circuit breaker + bulkhead on the PSP/gateway client (v1 R-19) —
      open breaker → typed `DEPENDENCY_UNAVAILABLE` 503 with retry-after.
- [ ] Mock PSP in `services/commerce/testsupport/`: configurable `FAULT_RATE`
      (timeouts, 5xx, signature-valid failures) for saga tests.

## Done when

- Relay crash test: kill relay between publish and mark → exactly-once
  *effect* observed (idempotent consumer); webhook raw-bytes test green
  (mutated body → rejected); breaker test green.

## Verification

```bash
mvn -f services/commerce/pom.xml test   # outbox, webhook, breaker suites
```
