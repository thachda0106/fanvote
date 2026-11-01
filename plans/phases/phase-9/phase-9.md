# Phase 9 — AWS: EKS lab, k6 proof, teardown

**Days:** 4 · **Tier:** P2 · **Order position:** 11th

**Objective:** the only place absolute performance numbers are produced —
production-shaped EKS proof, captured and torn down the same day.

> **Cloud boundary: the AI writes the numbered command report; YOU run every
> command.** Region **ap-southeast-1** (Singapore) — ap-northeast-1 is full
> (11 VPCs, ServiceLimitExceeded). Never touch company VPCs.

**Depends on:** Phase 8 gate; G-C (absolute numbers only from here); gate 5
(Strimzi vs MSK).

## Tasks

| # | Task | ID |
|---|---|---|
| 1 | Terraform (design → applied by you) | T9.1 |
| 2 | Production-shaped proof (the only `source: eks` rows) | T9.2 |
| 3 | Teardown (same day) + cost record | T9.3 |

## Phase gate

```bash
# proofs captured (k6 JSON, Jaeger vote trace, HPA behavior, cost)
# aws eks describe-cluster → not found; zero leftover ELB/SG/NAT
```

## Explain gate

Cost/ops defense: what ran where, why Strimzi vs MSK, what the numbers prove
and what they don't (simulated payments), and the $/hour story.
