# Task 4.3 — Token verification architecture (unambiguous)

**Phase:** 4 · **ID:** T4.3 · **Depends on:** T4.1, T4.2 · **decision gate 11**

## Objective

One written + tested trust model: edge pre-filter, service authority, zero
trust on identity headers.

## Subtasks

- [ ] **Edge:** gateway validates JWT signature/iss/aud as a cheap pre-filter —
      NOT the only check (documented in ADR-0007, restated here).
- [ ] **Services:** each verifies the JWT **locally** against a JWKS
      **cached in-process** (TTL + refresh-on-unknown-`kid` = rotation-safe) —
      **zero identity-service calls on the hot path** (test: identity down,
      existing tokens still verify from cache; new-kid refresh works when
      identity returns).
- [ ] **Zero trust:** services never honor identity headers supplied by a
      client. Gateway-set headers (`X-User-Id` etc.) are accepted ONLY from
      the gateway — enforce with **NetworkPolicy** (only gateway namespace can
      reach the header-trusting port/path) AND strip/overwrite at the edge.
      Test: client sends forged `X-User-Id` → service uses the JWT's sub, not
      the header.
- [ ] Business permissions re-checked inside the service (ownership of the
      order, quota of the JWT sub) — never delegated to the edge.
- [ ] **Service-to-service auth:** gate 11 — NetworkPolicy + audience-
      restricted JWT (no mesh); mTLS/Linkerd = stretch. Record audience list
      in `docs/decisions.md`.
- [ ] Contract conformance (T2.7 harness) applied to identity responses.

## Done when

- Forged-header test green; identity-down cache test green; NetworkPolicy
  manifests present in Helm values.

## Verification

```bash
make e2e   # zero-trust suite + cache-rotation suite
```
