# Phase 7 — Kubernetes production mechanics

**Days:** 3 · **Tier:** P2 · **Order position:** 9th

**Objective:** workload mechanics that make a rollout boring — probes, PDB,
right-sized resources, zero-downtime deploys proven by load, not by hope.

**Depends on:** Phase 6 gate; capacity data from T2.4/T3.5 for sizing.

## Tasks

| # | Task | ID |
|---|---|---|
| 1 | Workloads (HPA, PDB, probes, resources, secrets) | T7.1 |
| 2 | Zero-downtime rollout proof | T7.2 |

## Phase gate

```bash
make deploy-kind && make smoke   # + 200 RPS rollout run with 0 failed requests
```

## Explain gate

Probe semantics (liveness vs readiness vs startup), PDB vs HPA interaction,
and how resource requests were derived from k6 data (not guesses).
