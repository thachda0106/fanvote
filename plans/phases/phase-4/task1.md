# Task 4.1 — Identity service

**Phase:** 4 · **ID:** T4.1 · **Depends on:** T1.3 (mock issuer contract),
T1.4 · **v1 D-01, D-11, R-06, R-18**

## Objective

Real OAuth2 + RS256 identity with the exact JWKS contract the mock already
proved — and the v1 identity bug classes structurally impossible.

## Subtasks

- [ ] OAuth2 authorization-code + **PKCE**; consent/token endpoints per
      `contracts/openapi/identity.yaml`.
- [ ] RS256 signing with **JWKS endpoint served by the service**
      (`/.well-known/jwks.json`); keys: dev env vars in kind, **AWS Secrets
      Manager in EKS** — ephemeral-key fallback = **boot FAILURE, not a warn**
      (v1 R-06).
- [ ] Opaque refresh tokens: rotation on every use + **family revocation** on
      reuse detection.
- [ ] OAuth flow state in **Redis with 10-min TTL** — no per-process maps
      (v1 D-11) → cross-instance login completes with 2 pods, no stickiness
      (v1 R-18).
- [ ] id_token: JWKS verify (iss/aud/exp) **always** — including tokens from
      the mock IdP path (v1 D-01).
- [ ] Mock/dev profile (T1.3) kept as the `test` profile — same signing path,
      no user interaction; e2e tests use it.
- [ ] Tests: forged/unsigned/wrong-aud/expired token rejected; JWKS rotation
      (new kid accepted without restart, old kid rejected after TTL); refresh
      reuse → family revoked; cross-instance login green.

## Done when

- Identity e2e green incl. rotation + family-revocation + cross-instance tests.

## Verification

```bash
make e2e   # includes identity suite against 2 gateway/service replicas
```
