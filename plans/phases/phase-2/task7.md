# Task 2.7 — Contract conformance harness (B2)

**Phase:** 2 · **ID:** T2.7 · **Depends on:** T0.4, T2.5

## Objective

Spectral lints the *spec*; this lints the *implementation* against it. Reusable
harness, first applied to vote, mandatory for commerce (3.5), identity (4.3),
analytics (5.2).

## Subtasks

- [ ] `contracts/conformance/` helper: given a live base URL + spec path,
      validate every e2e-captured response — status code exists in spec,
      body validates against schema (response + error envelope), headers
      (content-type, correlation id) match.
- [ ] Tooling choice: `@apidevtools/swagger-parser` + `ajv` (Node) for
      vote/identity; note the Python equivalent for analytics later — OR one
      language-agnostic runner (e.g. `schemathesis`-style) hitting the HTTP
      API — decide and document in ADR-0002.
- [ ] Wire into `make e2e` for vote: every exercised route's responses are
      validated (not just the happy path — error envelopes too).
- [ ] Negative test: change a response field in code without updating the
      spec → conformance job fails (proves it bites).

## Done when

- Conformance runs in `make e2e` for vote; negative test demonstrated once;
  harness documented for reuse in Phases 3–5.

## Verification

```bash
make e2e   # fails if implementation drifts from vote.yaml
```
