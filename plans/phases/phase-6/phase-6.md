# Phase 6 — Resilience + chaos

**Days:** 4 · **Tier:** P1 (last) · **Order position:** 8th

**Objective:** failure-mode docs become executable tests — typed degradation,
no cascading failure, no duplicate side effects, self-healing pods.

**Depends on:** Phase 5.5 gate; all services have failure semantics hooks.

## Tasks

| # | Task | ID |
|---|---|---|
| 1 | Failure semantics per dependency | T6.1 |
| 2 | Chaos suite | T6.2 |

## Phase gate

```bash
make chaos   # green = Phase 6 exit; also required green in Phase 8 (alerts)
```

## Explain gate

`docs/learning/kubernetes-networking.md` + failure semantics defense: per
dependency — timeout, retry policy, breaker state, bulkhead, typed 503 — and
what changes at 10×.
