# Task 10.1 — HIGH-TRAFFIC-REPORT + README headline

**Phase:** 10 · **ID:** T10.1 · **Depends on:** T9.2, T9.3

## Objective

One document that answers "did it work, at what cost, and what changed?" —
with sourced numbers.

## Subtasks

- [ ] Create `docs/HIGH-TRAFFIC-REPORT.md`:
  - **before(v1) / after(v2)** table: architecture diagram, knee RPS,
    p50/p95/p99 per service, checkout res/s, chaos results, cost;
  - every capacity row carries its `source:` (kind-local vs eks) — no mixed
    provenance (G-C);
  - explicit note: **payments simulated (mock PSP)** — no overclaiming;
  - LHCI numbers (T5.5.2) as the frontend evidence;
  - defect-inventory mapping: D-/R- IDs → which test/ADR now prevents them.
- [ ] `README.md` headline: what it is, stack line, the 2–3 headline numbers,
  how to run (`make help`), link to the report and `docs/adr/`.
- [ ] Accuracy pass: every claim in README/report traceable to a test,
  capacity row, or ADR (no hand-typed bullets).

## Done when

- Report + README complete; a reviewer can trace every number to its source.

## Verification

- Manual trace audit of each headline claim (file/line or capacity row cite).
