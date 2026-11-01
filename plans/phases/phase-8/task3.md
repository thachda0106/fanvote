# Task 8.3 — Runbook

**Phase:** 8 · **ID:** T8.3 · **Depends on:** T8.1, T8.2

## Objective

`docs/runbook.md` an on-call stranger could follow at 03:00.

## Subtasks

- [ ] **Scale-up:** HPA knobs, manual scale command, expected time-to-healthy,
      capacity table reference (`docs/capacity.md`).
- [ ] **DLQ drain:** how to inspect DLQ topic, replay tooling, when NOT to
      replay (poison schema) — tie to `kafka-delivery-semantics` learning doc.
- [ ] **Reconciliation schedule:** payment reconciliation job — how to run
      manually (`make reconcile`), expected cadence in EKS (EventBridge,
      Phase 9), how to verify convergence with zero manual repair (T3.4).
- [ ] **Incident paths:** per alert → first checks (dashboard link, kubectl
      commands, Jaeger query) → escalation/decision points.
- [ ] **Common ops:** deploy/rollback (`helm rollback`), datastore failover
      expectations, secret rotation (JWKS key rotation procedure from T4.1).
- [ ] Each runbook section links the alert that leads to it.

## Done when

- Runbook reviewed against `make chaos` outcomes — every chaos scenario has a
  corresponding "what you'd do" section.

## Verification

- Dry run: pick 3 alerts, walk the runbook steps on the kind stack.
