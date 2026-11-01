# ADR-0002 — Contracts first: `contracts/` is the only shared artifact

- **Status:** Accepted
- **Date:** 2026-10-31
- **Phase:** 0 (T0.3) · **Kills review findings:** B2, C3 · plan ground rule 3

## Context

Four services in three languages (TypeScript, Java, Python) plus a TS client.
Any attempt to share runtime code across languages (or even share TS types by
path-import across package boundaries) rots immediately: the moment Python
"imports TypeScript" or services drift from one hand-maintained interface, the
monorepo becomes a coupling trap. Also: v1 never validated that
implementations matched the documented API — specs and code drifted silently.

## Decision

1. **`contracts/` is the seam.** HTTP = OpenAPI 3 per service
   (`contracts/openapi/{identity,vote,commerce,analytics}.yaml`); events =
   AsyncAPI (`contracts/asyncapi.yaml`). Nothing else is shared across
   service boundaries — no cross-language imports, no shared DTO packages,
   no generated code committed from another service's tree.
2. **Client types are generated, not handwritten:** `apps/web` runs
   `openapi-typescript` against the committed specs — the client cannot drift
   from the contract.
3. **Server-conformance rule (B2):** a spec being green under Spectral is not
   enough — every service's e2e suite validates **real responses** against
   its OpenAPI file (reusable harness built in T2.7, required for commerce
   T3.6, identity T4.3, analytics T5.2). Implementation is linted by the
   contract, not just the document.
4. **Evolution gate:** `contracts/baseline/` holds the last merged specs;
   CI runs `oasdiff breaking baseline/<svc>.yaml <svc>.yaml` (+ same
   evolution check for AsyncAPI). Newly-required request fields, removed
   fields, or changed types **fail the PR**. Baseline is committed in T0.4
   so the first PR can diff (C3).
5. **Messages:** every AsyncAPI channel must have ≥ 1 producer **and** ≥ 1
   consumer in `event-ownership.md`, cross-checked by CI — a consumer with no
   producer (v1 D-08/09/10 class) cannot merge.

## Consequences

- **Gained:** drift becomes a CI failure, not a prod surprise; language
  teams work independently; the CV "contracts-only polyglot" claim is real.
- **Gave up:** refactoring across services in one PR (must stage contract →
  producer → consumer); generated client regeneration is a build step.
- **Cost:** oasdiff/spectral toolchain maintenance — accepted, it's the price
  of the polyglot seam.

## Alternatives

- **Shared TS types package:** dies at the Python/Java boundary; path-import
  coupling. Rejected.
- **Pact broker from day 1:** heavyweight for 4 services / 1 primary
  consumer pair — consumer-driven check is lightweight test-to-schema instead
  (T5.1); broker = stretch if a third consumer appears.
- **No baseline / diff against empty main:** first PR cannot classify
  breakage (C3). Rejected — baseline committed with the initial specs.

## How to verify

`make contract` green locally; deliberately remove a response field →
oasdiff fails → revert (T0.4 negative test); server-conformance harness
green per service from Phase 2 on.