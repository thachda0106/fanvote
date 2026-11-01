# plans/phases — v2 rebuild, one folder per phase

Source plan: `../2026-10-31-v2-microservices-rebuild.md` (v2.1).
Each phase folder = `phase-N.md` (objective, task index, gate, explain gate) +
`task1.md … taskN.md` (one file per task: subtasks, done-when, verification).

| Folder | Phase | Tasks | Days |
|---|---|---|---|
| `phase-0/` | Decisions, contracts, scaffold | 8 | 3 |
| `phase-1/` | Walking skeleton | 6 | 3 |
| `phase-2/` | Vote context | 9 | 5.5 |
| `phase-3/` | Commerce: ticketing + payments | 6 | 5 |
| `phase-4/` | Identity + gateway policies | 3 | 4 |
| `phase-5/` | Analytics + notify | 2 | 3 |
| `phase-5.5/` | Fan client, Next.js 15 | 3 | 2 |
| `phase-6/` | Resilience + chaos | 2 | 4 |
| `phase-7/` | Kubernetes production mechanics | 2 | 3 |
| `phase-8/` | Observability & SLOs | 3 | 3 |
| `phase-9/` | AWS: EKS lab, k6 proof, teardown | 3 | 4 |
| `phase-10/` | The artifact | 2 | 2 |

Execution order: `0 → 1 → 2 → 3 → 4 → 5 → 5.5 → 6 → 7 → 8 → 9 → 10`.
Tiers: **P0** = 0–3 · **P1** = 4–6 · **P2** = 7–10.
Gates are cumulative/lazy (ground rule 7); each phase folder lists its own gate.
