# Phase 5.5 — Fan client, Next.js 15

**Days:** 2 · **Tier:** P1 · **Order position:** 7th

**Objective:** close the CV's frontend claim (React/Next/TS + Core Web
Vitals, machine-enforced) and give k6 a realistic fan journey.

**Depends on:** Phase 5 gate; G-E (SSE vs polling); contracts complete.

## Tasks

| # | Task | ID |
|---|---|---|
| 1 | Three pages, contract-typed | T5.5.1 |
| 2 | Lighthouse budget as a CI gate (stub mode) | T5.5.2 |
| 3 | Realistic load shape (mixed-event-night) | T5.5.3 |

## Phase gate

```bash
make web-lighthouse && make load
```

## Explain gate

SSR vs client components, the hydration boundary, and why types generated
from OpenAPI make client drift impossible.
