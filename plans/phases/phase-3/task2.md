# Task 3.2 — Aggregates & state machine

**Phase:** 3 · **ID:** T3.2 · **Depends on:** T3.1 · **v1 R-14 lesson**

## Objective

Order + Payment + TicketInventory with invariants enforced in code AND the
database — checkout never serialised on the hot row.

## Subtasks

- [ ] `Order` (JPA `@Version` optimistic lock): states
      `HELD → AWAITING_PAYMENT → SOLD | RELEASED` — every forbidden
      transition throws a typed domain error (unit-tested exhaustively:
      allowed/forbidden matrix).
- [ ] `Payment`: exactly one per order; states `INITIATED → CAPTURED | FAILED
      | REFUNDED` (linked from T3.4 saga).
- [ ] `TicketInventory` with fair locking: **lock seat/inventory rows in
      stable order (ORDER BY id), never the drop/aggregate root row** — v1
      R-14 serialised checkout to ~10/s. Unit/integration test asserts lock
      acquisition order under concurrency.
- [ ] Hold semantics: TTL on `HELD` (expired holds release inventory —
      scheduled + on-read sweep).
- [ ] Invariants as DB `CHECK` + unique constraints (final backstop) —
      e.g. `CHECK (state = 'SOLD' → payment_id IS NOT NULL)`.
- [ ] Event-config rule honored: `event_id` opaque FK; inventory created via
      `seed tickets` / admin path only.
- [ ] Contract conformance (T2.7 harness) applied to hold/buy routes.

## Done when

- Transition matrix tests green; concurrency test proves ordered locking
  (no deadlock, no oversell at the repository level); DB CHECKs proven by a
  deliberate-violation test.

## Verification

```bash
mvn -f services/commerce/pom.xml test   # matrix + locking + constraint suites
```
