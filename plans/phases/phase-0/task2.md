# Task 0.2 — Resolve all decision gates → ADR-0007

**Phase:** 0 · **ID:** T0.2 · **Depends on:** T0.1 · **Kills review finding A1**

## Objective

Close gates G-A…G-I before any routing/auth code exists — especially the
gateway JWKS problem (Kong OSS cannot fetch/refresh JWKS).

## Subtasks

- [x] Record answers for **G-A (gateway + JWKS)**, G-B (repo name), G-C (load
      provenance), G-D (fresh event per k6 run), G-E (SSE owner), G-F (HPA
      custom metric/KEDA), G-H (Nest migration tool), G-I (version pins), plus
      legacy gates 2–11, in `docs/decisions.md` § "Decision gates".
- [x] Create `docs/adr/0007-gateway-jwt-verification.md`:
  - context: edge needs signature/iss/aud pre-filter; services verify locally;
  - chosen gateway — **resolved to Envoy Gateway** (was "Envoy Gateway or
    Apache APISIX"): OSS `SecurityPolicy` remote-JWKS with issuer/audiences,
    cache + refresh-on-unknown-kid rotation;
  - rejected: Kong OSS `jwt` (static per-consumer keys only), `openid-connect`
    (Enterprise-only), custom Kong plugin (+2 days), thin NestJS BFF;
  - what the edge checks vs what services check (pre-filter ≠ authority).
- [x] Note any gate that changes a plan default (e.g. G-E → SSE in vote) and
      update the affected task files in `plans/phases/`.
- [x] Cloud gates (any Terraform/EKS write op) marked as "user runs".

## Done when

- G-A…G-I all answered; ADR-0007 merged; no gate left on "default if silent"
  where a task already depends on it.

## Verification

- `plans/phases/phase-1/task2.md` (gateway routes) cites G-A answer directly;
  no placeholder text remains.
