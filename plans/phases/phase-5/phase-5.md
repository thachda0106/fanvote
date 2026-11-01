# Phase 5 — Analytics + notify (FastAPI)

**Days:** 3 · **Tier:** P1 · **Order position:** 6th

**Objective:** projections only — never a source of truth. Consumers that
cannot corrupt, cannot duplicate, cannot crash-loop.

**Depends on:** Phase 4 gate; `vote.cast` (T2.8), `ticket.confirmed` (T3.3).

## Tasks

| # | Task | ID |
|---|---|---|
| 1 | Consumers only — never the truth (idempotent, CDV) | T5.1 |
| 2 | Prove it (< 1 s feed, DLQ, load) | T5.2 |

## Phase gate

```bash
make e2e   # includes analytics assertions (feed < 1s, poison → DLQ)
```

## Explain gate

`docs/learning/kafka-delivery-semantics.md` — at-least-once, idempotent
consumers, manual commit policy, DLQ, and why analytics can never become truth
(truth map defense).
