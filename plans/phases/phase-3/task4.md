# Task 3.4 — Payment saga — explicit, documented, tested

**Phase:** 3 · **ID:** T3.4 · **Depends on:** T3.3

## Objective

The cases the simple diagram hides are written down, coded, and acceptance-
tested. Recovery is scheduled machinery, never operator memory.

## Subtasks

- [ ] ADR `docs/adr/0008-payment-saga.md` — full transition record
      (allowed/forbidden, timeout, compensation):
  - order `HELD → AWAITING_PAYMENT → SOLD | RELEASED` **plus** payment
    `INITIATED → CAPTURED | FAILED | REFUNDED`;
  - **capture OK but response timeout / crash before local update** → order
    stays `AWAITING_PAYMENT` → **reconciliation is the recovery**: scheduled
    comparison of provider records vs local state (EventBridge →
    `run-task reconcile` wired Phase 9), converges with ZERO manual repair;
  - inventory expires mid-payment and capture lands after expiry →
    compensation = auto-refund OR documented refusal + alert — **pick one in
    `docs/decisions.md`** (no silent money loss either way);
  - `payment.failed` / saga timeout → **release inventory in the SAME tx**;
  - ticket confirmation fails after capture → outbox retries, never a 2nd charge.
- [ ] Implement reconciliation job (runnable locally via `make reconcile` now,
      scheduled in Phase 9).
- [ ] **Acceptance test (a):** mock provider returns SUCCESS, local update
      deliberately failed → run reconciliation → state converges, zero
      manual repair, no double charge.
- [ ] **Acceptance test (b):** migration tests per DB live in T3.6 (fresh ·
      upgrade · expand-contract under rolling deploy) — linked here as the
      saga's data-safety half.

## Done when

- ADR-0008 merged with every transition accounted for; acceptance test (a)
  green; compensation choice recorded in decisions.

## Verification

```bash
mvn -f services/commerce/pom.xml test -Dtest=SagaReconciliationTest
```
