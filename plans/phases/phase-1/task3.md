# Task 1.3 — Mock IdP / dev token issuer

**Phase:** 1 · **ID:** T1.3 · **Depends on:** T1.2 · **Kills review finding A2**

## Objective

Auth usable in Phases 1–3 although identity-as-a-product lands in Phase 4 —
quota (Phase 2) and orders (Phase 3) need a user identity before then.

## Subtasks

- [ ] Minimal issuer inside `services/identity` `test`/`dev` profile (or
      `services/identity/testsupport/`): generates RS256 keypair on boot,
      serves `/.well-known/jwks.json`, mints tokens for a seeded user set
      (`seed/` users from T2.1 — placeholder users allowed now).
- [ ] Same claims/iss/aud/kid contract as the real Phase 4 issuer — only the
      OAuth dance is absent; signing path identical.
- [ ] Gateway + services fetch JWKS from this endpoint (proves rotation-safe
      verification path early).
- [ ] `make token USER=...` helper prints a dev token for curl/manual tests.
- [ ] Document in `docs/decisions.md` (product-rules row: "mock IdP signs too").

## Done when

- Gateway accepts a mock-issued token, rejects a forged one (wrong sig) and an
  expired one; identical flow works from two gateway replicas (no stickiness).

## Verification

```bash
TOKEN=$(make token USER=fan-1) && curl -H "Authorization: Bearer $TOKEN" .../api/v1/... # 200
curl with tampered signature ...   # 401
```
