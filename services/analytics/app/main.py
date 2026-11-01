"""Eventista analytics — FastAPI skeleton (projections only, never truth)."""

from __future__ import annotations

import structlog
from fastapi import FastAPI
from fastapi.responses import JSONResponse, PlainTextResponse
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

logger = structlog.get_logger(service="analytics")

app = FastAPI(
    title="Eventista Analytics API",
    version="0.1.0",
    description="Activity feed + aggregates — projections only (ADR-0001).",
)


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    """Liveness — datastore-independent (never boot-fail on a blip, R-17)."""
    return {"status": "ok"}


@app.get("/readyz")
async def readyz() -> JSONResponse:
    """Readiness — 503 when degraded (D-12). Checks wired in Phase 6."""
    return JSONResponse(content={"status": "ready", "checks": []})


@app.get("/metrics")
async def metrics() -> PlainTextResponse:
    """Prometheus exposition (RED metrics land Phase 1/8)."""
    return PlainTextResponse(
        content=generate_latest().decode("utf-8"),
        media_type=CONTENT_TYPE_LATEST,
    )
