# Phase 1 — Walking skeleton

**Days:** 3 · **Tier:** P0 · **Order position:** 2nd

**Objective:** one traced request flows gateway → all 4 services → response,
and one real event flows vote → outbox → Kafka → analytics — before any
domain depth. ★ Prove the platform before the domains.

**Depends on:** Phase 0 gate green; G-A (gateway), G-B (repo) answered.

## Tasks

| # | Task | ID |
|---|---|---|
| 1 | kind cluster | T1.1 |
| 2 | Gateway → services end-to-end | T1.2 |
| 3 | Mock IdP / dev token issuer (A2) | T1.3 |
| 4 | Tracing from day one | T1.4 |
| 5 | Prove the async path in the skeleton | T1.5 |
| 6 | Observability fundamentals = "service done" | T1.6 |

## Phase gate

```bash
make e2e    # smoke + trace assertion + async doc appears < 1s
```

`make e2e` becomes mandatory for every later phase (lazy gate starts here).

## Explain gate

Trace one request across 3 languages + the bus end-to-end; defend why the
mock IdP (T1.3) is not a shortcut — same signing/JWKS contract as Phase 4.
Record in `docs/learning/observability.md`.
