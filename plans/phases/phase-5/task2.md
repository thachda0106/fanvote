# Task 5.2 — Prove it

**Phase:** 5 · **ID:** T5.2 · **Depends on:** T5.1

## Objective

End-to-end latency through the bus, poison-message containment, and read
performance under the event-night shape.

## Subtasks

- [ ] **E2E:** vote in `vote` service → activity doc appears in Mongo
      **< 1 s** (through gateway + outbox + Kafka + consumer), asserted in
      `make e2e` with trace linkage (same traceparent, T1.4).
- [ ] **Poison message:** malformed `vote.cast` payload → routed to **DLQ
      topic** after bounded attempts, consumer group keeps progressing (no
      crash loop, no blocking partition) — DLQ depth gauge increments.
- [ ] **Load:** analytics read endpoints under `mixed-event-night` shape
      (Phase 5.5 rewrites it — here: a lighter internal k6 script) stay
      **p95 < 500 ms**; row recorded with `source: kind-local`.
- [ ] Notify stub: `ticket.confirmed` → notification doc rendered; provider
      outage (stub FAULT_RATE) → retries then DLQ, no data loss.

## Done when

- Feed < 1 s + poison → DLQ + notify path green in `make e2e`; load row
  recorded with source.

## Verification

```bash
make e2e && make load
```
