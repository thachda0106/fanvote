# Task 2.3 — The correctness layers

**Phase:** 2 · **ID:** T2.3 · **Depends on:** T2.2 · **v1 lessons, fewer stores**

## Objective

Three independent layers, each cheap on the hot path, with the database as
final backstop — no single point of trust.

## Subtasks

- [ ] **Layer 1 — gateway edge:** Redis sliding-window rate limit (from T1.2,
      tuned strict for vote routes).
- [ ] **Layer 2 — Redis Lua guard:** `cast_vote.lua` in ONE RTT —
      SET NX per `(event,user,day)` + quota accumulation + counter increment;
      returns accepted/rejected + remaining quota. Script unit-tested with
      `redis-cli EVAL` fixtures (no app code needed).
- [ ] **Layer 3 — PG backstop:** `UNIQUE (event_id, user_id)` + `CHECK`
      constraints; a test deliberately bypasses Redis → DB rejects the second
      vote with a typed 409 (not a 500 — constraint-violation mapping).
- [ ] **Leaderboard:** SET index + MGET pipeline — **never SCAN** (v1 6.26 s
      trap); separate namespaces for voter vs candidate counters (v1
      key-prefix bug): `vote:evt:{id}:leader` vs `vote:evt:{id}:voters`.
- [ ] Leaderboard read path: top-N by score with `ZSET`-equivalent or
      SET+sorted read — document chosen structure in code comment + capacity
      note (memory bound per event).
- [ ] Redis down → vote degrades: fallback to PG-only path with typed 503 on
      contested path? Decision: **typed 503 + retry-after** (ground rule 8,
      v1 R-17: no process.exit, no silent wrong answers).

## Done when

- Each layer individually testable (Lua fixtures, repo tests, constraint test);
  backstop proven by the deliberate-bypass test.

## Verification

```bash
npm test -w services/voting   # includes lua + constraint-bypass suites
```
