# Task 2.2 — Domain first

**Phase:** 2 · **ID:** T2.2 · **Depends on:** T2.1

## Objective

The `Ballot` aggregate as pure TypeScript — zero I/O, unit tests written
BEFORE any repository/Lua/HTTP code.

## Subtasks

- [ ] `services/voting/src/domain/ballot.ts` — pure aggregate:
  - quota window: 10 points **per event per day (GMT+7)** — window math pure
    (given `now` + tz, returns window bounds);
  - point bounds: vote value 1..N rules (per `docs/decisions.md` Q answer);
  - re-vote rejection: second vote by same user on same event → typed
    domain error (`RE_VOTE_NOT_ALLOWED`, Q-27);
  - quota exhausted → typed `QUOTA_EXHAUSTED` with `reset_at`.
- [ ] `services/voting/src/application/cast-vote.handler.ts` — use-case
      orchestration: domain check → Lua guard → repo persist → outbox write
      (same tx as persistence).
- [ ] `services/voting/src/infrastructure/` — pg repository, redis Lua guard
      wrapper, outbox writer (ports defined in application layer — hexagonal).
- [ ] **Unit tests FIRST** (no I/O): quota window across midnight GMT+7,
      DST-irrelevant boundary, re-vote, quota exhaustion, invalid point values.
- [ ] Error taxonomy: domain errors → typed HTTP mapping (409 re-vote,
      429 quota) — no 5xx for user errors.

## Done when

- Domain unit tests green with 100% branch coverage on quota/re-vote rules;
  no infrastructure imports inside `domain/`.

## Verification

```bash
npm test -w services/voting   # domain suite green, zero I/O mocks needed
```
