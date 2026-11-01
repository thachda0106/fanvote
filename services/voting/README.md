# voting — NestJS 11

Ballots, free-point quota (10/event/day GMT+7), leaderboard (counters +
ledger truth), PostGIS event catalog, SSE live stream (G-E) (ADR-0001).
Store: `pg-vote` (postgis/postgis image) + Redis `vote:*` namespacing (ADR-0004).

## Commands

```bash
npm install
npm run lint && npm test
npm run build && npm start        # :3002
```

## Endpoints (Phase 0 skeleton)

- `GET /healthz` · `GET /readyz` · `GET /metrics`

Domain endpoints are contract-first: `contracts/openapi/vote.yaml` —
implemented in Phase 2.

## Gotchas

- Pins exact in `package.json`; `no-console` is an ESLint error in `src/`.
- Correctness layers (edge → Lua → PG unique) are Phase 2 (T2.3) — do not
  add ad-hoc vote logic in the skeleton.
