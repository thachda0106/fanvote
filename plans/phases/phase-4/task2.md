# Task 4.2 — Gateway as the edge

**Phase:** 4 · **ID:** T4.2 · **Depends on:** T4.1, G-A · **v1 R-04**

## Objective

Edge policies: per-route rate limits, JWT pre-filter, request ids — nothing
else (no business logic in the gateway).

## Subtasks

- [ ] Per-route rate limits: **vote strict**, refresh/login moderate,
      analytics conservative (v1 R-04) — values in `values-kind.yaml` /
      `values-eks.yaml`, documented in ADR-0007.
- [ ] JWT verify via remote JWKS (G-A mechanism) with caching + refresh —
      edge = cheap pre-filter only.
- [ ] Request IDs: generate/propagate `X-Request-Id` + traceparent on every
      route (already from T1.2 — verify under load).
- [ ] `/metrics` **not public**: gateway blocklist + NetworkPolicy — test
      asserts external `GET /metrics` through the gateway → 404/403.
- [ ] WAF notes in ADR-0007 (Cloudflare = design, not code).
- [ ] Tests: refresh flood hits the **rate limit**, not Postgres (assert PG
      connection count stable during the flood); vote route stricter than
      analytics route proven by counter comparison.

## Done when

- Rate-limit + JWKS + metrics-blocklist tests green against kind.

## Verification

```bash
make e2e   # edge policy suite
```
