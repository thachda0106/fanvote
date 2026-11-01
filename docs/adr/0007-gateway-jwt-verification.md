# ADR-0007 — Gateway JWT verification (edge pre-filter + service authority)

- **Status:** Accepted
- **Date:** 2026-10-31
- **Phase:** 0 (T0.2) · **Gate:** G-A · **Kills review finding:** A1

## Context

The edge must reject garbage before it reaches a service (signature / iss /
aud as a cheap pre-filter), but the edge is **not** the trust authority —
services must be able to verify tokens themselves so a bypassed or misconfigured
gateway cannot grant access (zero-trust, plan Task 4.3). Review finding A1
showed the obvious choice fails: **Kong OSS cannot verify via JWKS** — its
`jwt` plugin only supports per-consumer static keys (no remote fetch, no
rotation) and `openid-connect` is Enterprise-only.

Constraints from the plan:

- identity serves an RS256 JWKS endpoint and rotates `kid`s (Phase 4; mock IdP
  in Phase 1 signs the same way);
- services verify **locally from a cached JWKS** — no per-request identity hop;
- per-route rate limits at the edge (vote strict, analytics conservative);
- runs on kind (Helm) first, EKS later — one config, both environments.

## Decision

**Chosen gateway: Envoy Gateway** (OSS, Gateway API), installed via its Helm
chart into `deploy/helm/eventista`.

### Edge behavior (pre-filter)

- One `HTTPRoute` per service (identity, vote, commerce, analytics).
- A `SecurityPolicy` targeting those routes configures a JWT provider:
  - `remoteJWKS.uri` → identity's JWKS URL (e.g. `https://identity:3000/jwks`);
  - `issuer` and `audiences` set to identity's values — claims checked at edge;
  - JWKS fetched over HTTPS with retry/backoff (Backend + BackendTLSPolicy for
    CA trust when needed), **cached in Envoy and refreshed on interval**;
    an unknown `kid` triggers a refetch, so key rotation converges without a
    gateway restart;
  - token extraction: `Authorization: Bearer` (default).
- Missing/invalid/expired token → edge **401** before any service sees it.
- `BackendTrafficPolicy` per route = local rate limit buckets (vote strict,
  auth/refresh strict, analytics conservative; health/metrics routes are not
  exposed through the gateway at all).

### Service behavior (authority)

- Each service verifies the JWT **in-process** against a JWKS it caches itself
  (TTL + refresh-on-unknown-kid, rotation-safe) — zero identity calls on the
  hot path (plan cross-service rules).
- Services **never** honor identity/subject headers supplied by a client;
  gateway-set headers are accepted only from the gateway (NetworkPolicy),
  and business permissions are re-checked inside the service.
- The edge check is therefore a **pre-filter, not the authority**: even if the
  gateway is bypassed inside the cluster, services still reject bad tokens.

### JWKS rotation contract

1. identity adds a new signing key, publishes both keys in JWKS with `kid`s;
2. edge and services pick up the new key via refresh (interval or unknown-kid);
3. identity retires the old key after max token TTL; verifiers drop it on the
   next refresh — no gateway restart, no mass logout (fixes v1 R-07 class).

## Rejected alternatives

| Alternative | Why rejected |
|---|---|
| Kong OSS `jwt` plugin | Per-consumer **static** keys only — no remote JWKS fetch, no rotation (A1). |
| Kong `openid-connect` plugin | Kong **Enterprise** only. |
| Custom Kong plugin | +2 days of Lua, own cache/rotation logic, own bugs; rotation gap documented as accepted risk — not acceptable when OSS does it natively. |
| Thin NestJS BFF proxy | Home-made proxy reads junior in interviews; concentrates routing + auth + rate-limit into app code we'd have to build and operate. |
| Apache APISIX | Viable OSS peer (also remote-JWKS capable); Envoy Gateway chosen for first-class Gateway API `SecurityPolicy`/`BackendTrafficPolicy` declaratives and one less custom ingress controller in the cluster. |
| No edge JWT check | Every service pays full verify + every garbage request reaches a backend; loses the cheap pre-filter and per-route 401 shaping. |

## Consequences

- **Gained:** OSS-only auth edge, declarative per-route limits, rotation-safe
  JWKS, Gateway API standard (portable mental model), Helm-values-per-env.
- **Gave up:** Kong name-recognition on the CV line; global (cluster-wide)
  rate-limit buckets — Envoy Gateway *local* rate limit is per-gateway-instance
  and per-route (single gateway deployment = acceptable; a shared global
  limiter needs the global-ratelimit service = stretch, not a gate).
- **Risk:** gateway buffering vs SSE (G-E) — mitigation: polling-first
  fallback, SSE as stretch (ADR-0001).
- **Ops:** chart/image version pinned in T0.6; upgrade notes in runbook (Phase 8).

## How to verify

- Phase 1 (T1.2/T1.3): gateway accepts a mock-issued token, rejects a forged
  one (`make smoke`); Phase 4: JWKS rotation test — old `kid` rejected after
  TTL, new `kid` accepted without restart; client-forged gateway header
  ignored by services (T4.3); per-route 429 under refresh flood (T4.2).