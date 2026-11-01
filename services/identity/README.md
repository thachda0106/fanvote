# identity — NestJS 11

OAuth2 authorization-code + PKCE, RS256 JWT, JWKS endpoint (ADR-0001, ADR-0007).
Store: logical DB `identity` on the `pg-app` Postgres instance (ADR-0004).

## Commands

```bash
npm install
npm run lint && npm test
npm run build && npm start        # :3001
```

## Endpoints (Phase 0 skeleton)

- `GET /healthz` — liveness, datastore-independent
- `GET /readyz` — readiness (503 when degraded — checks land Phase 6)
- `GET /metrics` — Prometheus

Domain endpoints (`/jwks`, `/api/v1/auth/*`, `/api/v1/users/me`) are
contract-first: `contracts/openapi/identity.yaml` — implemented Phase 1 (mock
token mint) / Phase 4 (full OAuth).

## Gotchas

- Pins are exact (no `^`) — see `package.json` + `docs/decisions.md` § Version pins.
- `no-console` is an ESLint error in `src/` — use the Nest `Logger`.
