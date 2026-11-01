# Task 5.5.1 — Three pages, contract-typed

**Phase:** 5.5 · **ID:** T5.5.1 · **Depends on:** T5.2, G-E · **gate 8: 3 pages only**

## Objective

Event page, live leaderboard, checkout — talking ONLY to the gateway, types
generated from contracts.

## Subtasks

- [ ] `apps/web/` Next.js 15 App Router + TS:
  - **event page**: vote button, quota state (remaining/reset_at from vote
    API), **composes two contract calls** — vote catalog + commerce inventory
    (event-config rule documented, no BFF hiding it);
  - **live leaderboard**: SSE per G-E with 1 s polling fallback (fallback must
    work standalone — tested);
  - **checkout**: hold → pay → confirm, typed error envelopes surfaced
    (429/409/503 states rendered meaningfully).
- [ ] Talks **only** to the gateway; types via `openapi-typescript` generated
      from `contracts/openapi/*.yaml` — CI check: regenerate + `git diff
      --exit-code` (client cannot drift from the contract).
- [ ] Login: redirect to identity (mock mode in dev) — no credentials in the
      client.
- [ ] Server components for reads; client components only where the fan
      interacts (vote button, SSE subscription, checkout form) — the
      SSR/hydration split is the interview talking point.
- [ ] Seeded dev data via `seed/` for local review.

## Done when

- Three pages functional against kind via the gateway; type-regen CI check
  green; polling fallback proven independent of SSE.

## Verification

```bash
make up && make seed && make deploy-kind   # manual: three journeys work
```
