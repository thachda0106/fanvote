# Task 0.1 — Answer the 52 questions once

**Phase:** 0 · **ID:** T0.1 · **Depends on:** —

## Objective

Turn the v1 open-question inventory into frozen, citable requirements so no
phase ever re-debates them.

## Subtasks

- [x] Create `docs/decisions.md` with one section per question **Q-01…Q-52**
      (source: `eventista-clone/docs/project-overview/22-unknown-and-open-questions.md`).
- [x] Each entry: **Decision** + one-line why. No prose essays, no "TBD".
- [x] Header = the v2 product-rules table (quota, re-vote, idempotency keys,
      webhook raw-bytes, JWKS, flow state, readiness, 5xx taxonomy, invariant
      tests, load provenance, mock-IdP rule, fresh-event load rule).
- [x] Tag each question with the phase that consumes it as acceptance criteria
      (e.g. Q-07 → Phase 2, Q-26 → Phase 2).
- [x] Cross-check the D-/R- defect IDs referenced by the plan actually exist in
      `17-legacy-and-technical-debt.md` / `18-architecture-risks.md`.

## Done when

- 52/52 answered; zero "TBD" / "deferred" entries.
- Every product rule row links to the Q/D/R IDs it kills.

## Verification

- Manual count + `grep -c "^### Q-" docs/decisions.md` = 52.
- Later phases cite `docs/decisions.md` by Q-ID only — no re-litigation.
