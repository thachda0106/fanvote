# Phase 4 — Identity + gateway policies

**Days:** 4 · **Tier:** P1 · **Order position:** 5th

**Objective:** v1's worst identity bugs never recur; the edge-vs-service trust
boundary is unambiguous (pre-filter ≠ authority; zero trust on headers).

**Depends on:** Phase 3 gate; G-A (gateway auth behavior).

## Tasks

| # | Task | ID |
|---|---|---|
| 1 | Identity service (PKCE, JWKS, rotation, Redis flow state) | T4.1 |
| 2 | Gateway as the edge (rate limits, JWKS, request ids) | T4.2 |
| 3 | Token verification architecture (zero-trust headers) | T4.3 |

## Phase gate

```bash
make e2e && make load   # auth on every route; refresh flood hits the limit, not PG
```

## Explain gate

Defend edge vs service verification, JWKS caching/rotation, and why services
never honor client-supplied identity headers. → `docs/reviews/security-review.md`.
