# Task 5.5.2 — Lighthouse budget as a CI gate (C4: stub mode)

**Phase:** 5.5 · **ID:** T5.5.2 · **Depends on:** T5.5.1 · **Kills C4**

## Objective

"Lighthouse 90+" becomes machine-enforced, not a hand-typed CV bullet — and
the job is deterministic.

## Subtasks

- [ ] Add `@lhci/cli` + config (`.lighthouserc.js`): assert
      **Performance ≥ 90, CLS < 0.1, LCP < 2.5 s** on all three routes.
- [ ] **Stub mode (C4):** run LHCI against a static export
      (`next build && next export`-style output or a fixture-data dev server)
      with mocked API responses — live-stack Lighthouse flaps; CI must not.
- [ ] Bundle budget: route JS **< 150 kB gzipped** — enforced as an LHCI
      assertion or a separate size check.
- [ ] CI job added to `.github/workflows/ci.yml` (web paths only).
- [ ] `make web-lighthouse` target runs the same thing locally.
- [ ] Results recorded for Phase 10 (`docs/HIGH-TRAFFIC-REPORT.md` frontend
      evidence).

## Done when

- `make web-lighthouse` green locally AND in CI; budgets fail the build when
  deliberately exceeded (negative test once, then revert).

## Verification

```bash
make web-lighthouse   # 3 routes × 3 assertions green
```
