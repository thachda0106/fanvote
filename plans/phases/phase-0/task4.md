# Task 0.4 — Contracts before code

**Phase:** 0 · **ID:** T0.4 · **Depends on:** T0.2, T0.3 · **Kills C3**

## Objective

The seam exists, is linted, and is protected against breaking changes before
a single service implements an endpoint.

## Subtasks

- [x] Create `contracts/openapi/identity.yaml`, `vote.yaml`, `commerce.yaml`,
      `analytics.yaml` — skeletons covering Phase 1 health/metrics routes plus
      the known domain endpoints (vote, events/near, orders, hold/pay,
      leaderboard, feed, SSE stream per G-E).
- [x] Create `contracts/asyncapi.yaml` with event schemas: `vote.cast`,
      `order.held`, `payment.captured`, `payment.failed`, `ticket.confirmed`,
      `notification.requested`.
- [x] Create `contracts/event-ownership.md` — row per event: producer,
      consumers, delivery guarantee, retry policy, DLQ topic; plus the
      **truth map** (vote = vote truth · commerce = order+payment truth ·
      identity = auth identity · analytics = **projections only**).
- [x] Bootstrap `contracts/baseline/` (commit initial merged baseline here —
      first PR cannot diff against an empty `main`; review finding C3).
- [x] Make targets:
  - `make contract` = `npx @stoplight/spectral lint contracts/**/*.yaml` → 0 errors
    + `oasdiff breaking contracts/baseline/*.yaml <changed>.yaml` → fails on
    removed fields / changed types / newly-required request fields + same
    evolution check for AsyncAPI.
- [x] CI cross-check: every AsyncAPI message has ≥1 producer AND ≥1 consumer;
      ownership-matrix rows match `asyncapi.yaml` channel names.

## Done when

- `make contract` green locally with a deliberately breaking edit proven to
  fail once (manual negative test, then revert).

## Verification

```bash
make contract
# negative: remove a response field, re-run → must FAIL, then git checkout
```
