# Task 1.1 — kind cluster

**Phase:** 1 · **ID:** T1.1 · **Depends on:** T0.5

## Objective

Local Kubernetes that reliably starts on this machine.

## Subtasks

- [x] Create `deploy/helm/kind-config.yaml` — 1 control-plane + 2 workers,
      port mappings for gateway/ingress (80/443 → node port).
- [x] `make kind-up`: `kind create cluster --config deploy/helm/kind-config.yaml
      --image kindest/node:v1.34.2`.
- [x] **Pitfall (verified on this box):** Docker Desktop cgroup v1 hard-refuses
      k8s ≥ 1.35 — never bump the node image without re-testing.
- [x] `make kind-load` target: build 4 service images + `kind load docker-image`
      (no registry needed locally).
- [x] kubectl context check + `kubectl get nodes` Ready ×3 in Makefile output.

## Done when

- `make kind-up` yields a Ready 3-node cluster reproducibly (fresh create →
  Ready in < 3 min).

## Verification

```bash
make kind-up && kubectl get nodes   # 3 nodes Ready
```
