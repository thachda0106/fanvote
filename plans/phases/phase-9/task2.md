# Task 9.2 — Production-shaped proof (G-C: the only absolute numbers)

**Phase:** 9 · **ID:** T9.2 · **Depends on:** T9.1, T6.2, T7.2

## Objective

Run the full evidence suite against the real cluster — every `docs/capacity.md`
headline row gets `source: eks` here.

## Subtasks

- [ ] Push 4 images → ECR → `helm install` with `values-eks.yaml` (probes,
      HPA, PDB, external-secrets live).
- [ ] Run `load/k6/event-night.js` (client-shaped from T5.5.3) at the target:
      **10,000 concurrent voters · 2,000 RPS vote path · p95 < 200 ms ·
      checkout ≥ 300 res/s** — capture k6 JSON.
- [ ] Run `load/k6/soak.js` — **30 min** steady state (memory/fd leak check).
- [ ] **Chaos at minute 20** of the soak: `make chaos` against the cluster —
      kill pod, broker down; assert same promises as Phase 6 (no 5xx storm,
      lag drains, no duplicate effects, HPA replaces).
- [ ] Capture: Jaeger trace of a real vote (gateway→vote→DB→Kafka→analytics),
      HPA behavior (scale events from kubectl), consumer lag/DLQ during chaos.
- [ ] **Cost estimate**: running resources × prices + control-plane
      ($0.10/h lab note) → documented before teardown.
- [ ] Write all rows into `docs/capacity.md` with `source: eks` (kind-local
      rows kept for comparison); note **payments simulated (mock PSP)**.

## Done when

- Target numbers recorded (or honest misses documented with analysis);
  soak clean; chaos green on EKS; trace + HPA capture stored in `docs/`.

## Verification

```bash
make load && make chaos   # against the EKS kubeconfig, JSON + traces archived
```
