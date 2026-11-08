# Task 1.2 — Gateway → services end-to-end

**Phase:** 1 · **ID:** T1.2 · **Depends on:** T1.1, T0.2 (G-A)

## Objective

One gateway, one route per service, rate-limit + JWT pre-filter — the sync
path the whole system funnels through.

## Subtasks

- [x] Create `deploy/helm/eventista/` for the **Envoy Gateway** (G-A resolved:
      ADR-0007): Gateway API `Gateway` + one `HTTPRoute` per service; values per
      env (`values-kind.yaml` now, `values-eks.yaml` in Phase 7).
- [x] Routes: `/api/v1/identity/*`, `/api/v1/votes/*`, `/api/v1/commerce/*`,
      `/api/v1/analytics/*` → respective ClusterIP services; strip/prefix rules
      documented.
- [x] **Rate limit** via `BackendTrafficPolicy` per route (defaults now; strict
      vote / conservative analytics tuned in Phase 4 — v1 R-04).
- [x] **JWT via `SecurityPolicy`**: `remoteJWKS.uri` = identity's JWKS URL,
      `issuer` + `audiences` set (edge = cheap pre-filter, not the authority —
      ADR-0007).
- [x] Request-id header injection/propagation (`X-Request-Id` + traceparent).
- [x] Wire compose datastores + `make deploy-kind` (kind loads images,
      `helm install eventista`).
- [x] Create `load/k6/smoke.js` — 10 RPS through gateway to every service's
      health + one real route each.

## Done when

- `make smoke` passes against kind: every route reachable, forged JWT
  rejected, rate limit engages.

## Verification

```bash
make deploy-kind && make smoke
```
