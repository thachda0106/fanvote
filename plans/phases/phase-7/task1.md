# Task 7.1 — Workloads (HPA, PDB, probes, resources, secrets)

**Phase:** 7 · **ID:** T7.1 · **Depends on:** T6.1, G-F

## Objective

Helm values per environment with production mechanics wired and sized from
data.

## Subtasks

- [ ] **HPA on CPU** (default per G-F); custom `k6`-derived RPS metric only
      if G-F chose KEDA (stretch — declarative in Helm, not a gate).
- [ ] **PodDisruptionBudget** `minAvailable: 1` per service.
- [ ] **Resource requests/limits sized from k6 data** (T2.4/T3.5 metrics →
      `docs/capacity.md`), not guesses; document the derivation table.
- [ ] **Probes:** liveness → `/healthz` (datastore-independent), readiness →
      `/readyz` (503 when degraded), startup probe for slow JVM boot;
      rollingUpdate `maxUnavailable: 0`, `maxSurge: 1`.
- [ ] **Secrets:** external-secrets operator (EKS) / Helm literals (kind) —
      same key names in both, documented; no secrets in git (CI secret scan
      from T0.8 must pass).
- [ ] Helm values split: `values-kind.yaml`, `values-eks.yaml` (env deltas
      are the point of Helm, gate 7).
- [ ] `make deploy-kind && make smoke` after every change.

## Done when

- Manifests apply cleanly to kind; probe behavior verified (kill datastore →
  pod ready=false, alive=true); sizing table filled from capacity data.

## Verification

```bash
make deploy-kind && kubectl get hpa,pdb   # configured; smoke green
```
