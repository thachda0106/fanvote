# analytics — FastAPI

Activity feed + aggregates + notify fan-out — **projections only, never
truth** (ADR-0001/0004). Consumes Kafka with idempotent handlers (Phase 5,
B6). Store: MongoDB + Redis `analytics:*`.

## Commands

```bash
uv sync
uv run ruff check app tests
uv run pytest
uv run uvicorn app.main:app --reload --port 8001
```

## Endpoints (Phase 0 skeleton)

`GET /healthz` · `GET /readyz` · `GET /metrics` — domain endpoints are
contract-first: `contracts/openapi/analytics.yaml` (Phase 5).

## Gotchas

- Pins exact in `pyproject.toml` (T0.6).
- No service reads another service's DB — events only (ADR-0004).
