# ADR-0005 — Kubernetes local-first, EKS later; delete playbook before create

- **Status:** Accepted
- **Date:** 2026-10-31
- **Phase:** 0 (T0.3) · **Gates:** G-C, G-B · absorbs v1's missing
  `adr/0008-iac-safety` content (Q-21) · plan ground rule 6

## Context

The platform must run on Kubernetes, but two facts dominate: (1) this
workspace's Docker Desktop uses **cgroup v1**, which hard-refuses k8s ≥ 1.35 —
kind must pin `kindest/node:v1.34.2`; (2) AWS work is a same-day lab with
real cost and real orphan risk (v1's Terraform was a never-applied design
artifact with 13 gaps — Q-35/R-28). Cloud writes must never be executed by
an agent.

## Decision

1. **kind first.** Phase 1 creates a 3-node kind cluster
   (`kind create --image kindest/node:v1.34.2`, `deploy/helm/kind-config.yaml`)
   and proves the whole stack there (`make deploy-kind`, `make smoke`,
   `make e2e`). All developer loops and CI (slim compose) stay local.
2. **EKS last (Phase 9), region ap-southeast-1 only**
   (ap-northeast-1 is quota-full; never touch company VPCs).
3. **Cloud rule — user runs every write op:** agents produce a **numbered
   command report**; the user executes each Terraform/EKS command. Agents may
   `terraform validate` / `plan` locally without credentials, never `apply`,
   never `aws eks …` mutations. Same-day create → prove → **delete**.
4. **Delete playbook BEFORE create:** `DELETE-PLAYBOOK.md` with the full
   resource inventory is committed before the first `apply`; teardown verified
   (`aws eks describe-cluster` → not found; zero leftover ELB/SG/NAT — check
   **classic** `aws elb`, not only elbv2). Duration + total cost recorded.
5. **Helm from day 1** (gate 7): one chart `deploy/helm/eventista`, values
   per environment (`values-kind.yaml`, later `values-eks.yaml`) — the same
   chart proves kind and EKS, only values differ.
6. **Secrets:** kind = literals/env; EKS = AWS Secrets Manager via
   external-secrets; missing signing keys in prod = boot **failure**
   (Q-36, kills R-06 silent ephemeral fallback).

## Consequences

- **Gained:** every k8s lesson learned before touching AWS; zero orphan risk
  from agent-run cloud commands; cost bounded to one lab day (~$0.10/h
  control plane + node hours); reproducible local cluster pinned to a node
  image that works on this box.
- **Gave up:** "it works on my EKS" during Phases 1–8 (accepted: absolute
  capacity numbers only come from Phase 9, G-C); instant cloud scale tests.
- **Friction:** kind version pin must be revisited if the host moves to
  cgroup v2 (then k8s ≥ 1.35 becomes possible — document, don't silently
  drift).

## Alternatives

- **minikube/k3d:** fine tools; kind is the plan's pin and matches upstream
  test practice — one choice, never re-debated (G-B spirit).
- **EKS from day 1:** cost + orphan risk + slow iteration; violates the
  cloud rule. Rejected.
- **Agent-applied Terraform:** v1's artifact proves specs rot without a
  human gate; plan ground rule 6 makes apply a human act. Rejected.
- **Terraform as validate-only artifact (v1 stance):** ship-shape for a
  design doc, but Phase 9 must actually prove capacity on real infra — so
  v2's Terraform is written to be applied, by the user, once (Q-35).

## How to verify

`make kind-up` Ready 3-node (T1.1); Phase 9 gate = proofs captured, cluster
deleted, cost recorded (T9.3); `terraform validate` clean in CI; no `apply`
in any agent-run command history.