"""Eventista analytics — FastAPI app (projections only, never truth).

T1.5: consumes `vote.cast` (consumer group `analytics`) and upserts activity
docs keyed by the event-message id. T1.6: structured logs, RED metrics,
liveness/readiness split (D-12), and OTel spans exported to the collector.
"""

from __future__ import annotations

import asyncio
import base64
import binascii
import json
import os
import time
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any

import structlog
from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, PlainTextResponse
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from app.consumers.vote_cast import run_consumer
from app.observability.errors import (
    AppError,
    DependencyUnavailable,
    ValidationFailed,
    app_error_handler,
    unhandled_error_handler,
)
from app.observability.logging import configure_logging
from app.observability.metrics import finish, http_in_flight
from app.observability.tracing import init_tracing, shutdown_tracing

configure_logging(os.getenv("LOG_LEVEL", "INFO"))
init_tracing()

logger = structlog.get_logger(service="analytics")


async def _supervise_consumer(app: FastAPI, mongo: MongoClient, stop: asyncio.Event) -> None:
    """Keep exactly one consumer running; restart from last commit on failure."""
    backoff = 1.0
    while not stop.is_set():
        try:
            app.state.consumer_ok = True
            await run_consumer(stop, mongo)
            backoff = 1.0
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001
            app.state.consumer_ok = False
            logger.exception("kafka.consumer_crashed", retry_in_s=backoff)
            await asyncio.sleep(min(backoff, 30.0))
            backoff = min(backoff * 2, 30.0)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    mongo_uri = os.getenv("MONGO_URL", "mongodb://localhost:57017")
    mongo = MongoClient(mongo_uri, serverSelectionTimeoutMS=2000)
    app.state.mongo = mongo
    app.state.activity = mongo["analytics"]["activity"]
    try:
        app.state.activity.create_index("eventId")
    except PyMongoError:
        logger.exception("mongo.index_create_failed")

    stop = asyncio.Event()
    app.state.stop = stop
    app.state.consumer_ok = True
    task: asyncio.Task[None] | None = None
    if os.getenv("CONSUMER_ENABLED", "true").lower() != "false":
        task = asyncio.create_task(_supervise_consumer(app, mongo, stop))
    app.state.consumer_task = task
    try:
        yield
    finally:
        stop.set()
        if task is not None:
            try:
                await asyncio.wait_for(task, timeout=5)
            except (TimeoutError, asyncio.CancelledError):
                task.cancel()
        mongo.close()
        shutdown_tracing()


app = FastAPI(
    title="Eventista Analytics API",
    version="0.1.0",
    description="Activity feed + aggregates — projections only (ADR-0001).",
    lifespan=lifespan,
)
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)
FastAPIInstrumentor.instrument_app(app, excluded_urls="healthz,readyz,metrics")


@app.exception_handler(RequestValidationError)
async def validation_error_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    logger.info("http.validation_failed", request_id=getattr(request.state, "request_id", None))
    return JSONResponse(
        status_code=400,
        content={
            "code": "VALIDATION_FAILED",
            "message": "invalid request",
            "requestId": getattr(request.state, "request_id", None),
        },
    )


@app.middleware("http")
async def observe(request: Request, call_next):  # noqa: ANN001, ANN201
    started = time.perf_counter()
    http_in_flight.inc()
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    request.state.request_id = request_id
    try:
        response = await call_next(request)
    except Exception:
        finish(request, 500, started)
        logger.exception(
            "http.unhandled",
            method=request.method,
            path=request.url.path,
            request_id=request_id,
        )
        raise
    finish(request, response.status_code, started)
    response.headers["x-request-id"] = request_id
    logger.info(
        "http.request",
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        duration_ms=round((time.perf_counter() - started) * 1000, 2),
        request_id=request_id,
    )
    return response


def _iso(value: Any) -> str | None:
    if isinstance(value, datetime):
        return value.astimezone(UTC).isoformat().replace("+00:00", "Z")
    if isinstance(value, str):
        return value
    return None


def _parse_uuid(value: str, field: str) -> str:
    try:
        return str(uuid.UUID(value))
    except (ValueError, AttributeError, TypeError) as exc:
        raise ValidationFailed(f"{field} must be a uuid") from exc


def _encode_cursor(doc: dict[str, Any]) -> str:
    payload = json.dumps({"occurredAt": _iso(doc["occurredAt"]), "id": doc["_id"]})
    return base64.urlsafe_b64encode(payload.encode()).decode()


def _decode_cursor(cursor: str) -> tuple[datetime, str]:
    try:
        data = json.loads(base64.urlsafe_b64decode(cursor.encode()))
        occurred = datetime.fromisoformat(data["occurredAt"].replace("Z", "+00:00"))
        return occurred, str(data["id"])
    except (ValueError, KeyError, TypeError, binascii.Error) as exc:
        raise ValidationFailed("cursor is invalid") from exc


def _parse_datetime(value: str | None, field: str) -> datetime | None:
    if value is None:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValidationFailed(f"{field} must be an RFC3339 datetime") from exc


def _activity_of(request: Request) -> Any:
    activity = getattr(request.app.state, "activity", None)
    if activity is None:
        raise DependencyUnavailable("mongo unavailable")
    return activity


def _find_activity(
    activity: Any, query: dict[str, Any], limit: int
) -> list[dict[str, Any]]:
    return list(
        activity.find(query).sort([("occurredAt", -1), ("_id", -1)]).limit(limit + 1)
    )


def _aggregate_votes(
    activity: Any, query: dict[str, Any], start: datetime | None, end: datetime | None
) -> list[dict[str, Any]]:
    match = dict(query)
    window: dict[str, datetime] = {}
    if start is not None:
        window["$gte"] = start
    if end is not None:
        window["$lte"] = end
    if window:
        match["occurredAt"] = window
    pipeline = [
        {"$match": match},
        {
            "$group": {
                "_id": {"$dateTrunc": {"date": "$occurredAt", "unit": "minute"}},
                "votes": {"$sum": 1},
                "points": {"$sum": {"$ifNull": ["$points", 0]}},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    return list(activity.aggregate(pipeline))


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    """Liveness — datastore-independent (never boot-fail on a blip, R-17)."""
    return {"status": "ok"}


@app.get("/readyz")
async def readyz(request: Request) -> JSONResponse:
    """Readiness — 503 when Mongo or the consumer is degraded (D-12)."""
    checks: list[dict[str, Any]] = []
    mongo = getattr(request.app.state, "mongo", None)
    mongo_ok = False
    if mongo is not None:
        try:
            await asyncio.to_thread(mongo.admin.command, "ping")
            mongo_ok = True
        except PyMongoError:
            logger.warning("readyz.mongo_degraded")
    checks.append({"name": "mongo", "ok": mongo_ok})

    consumer_ok = getattr(request.app.state, "consumer_ok", None)
    if consumer_ok is not None:
        checks.append({"name": "kafka-consumer", "ok": bool(consumer_ok)})

    ready = all(check["ok"] for check in checks)
    return JSONResponse(
        status_code=200 if ready else 503,
        content={"status": "ready" if ready else "degraded", "checks": checks},
    )


@app.get("/metrics")
async def metrics() -> PlainTextResponse:
    """Prometheus exposition (RED + consumer metrics)."""
    return PlainTextResponse(
        content=generate_latest().decode("utf-8"),
        media_type=CONTENT_TYPE_LATEST,
    )


@app.get("/api/v1/events/{eventId}/activity")
async def get_activity(
    request: Request,
    eventId: str,
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    """Cursor-paginated activity projection (newest first)."""
    event_id = _parse_uuid(eventId, "eventId")
    activity = _activity_of(request)
    query: dict[str, Any] = {"eventId": event_id}
    if cursor:
        occurred_at, doc_id = _decode_cursor(cursor)
        query["$or"] = [
            {"occurredAt": {"$lt": occurred_at}},
            {"occurredAt": occurred_at, "_id": {"$lt": doc_id}},
        ]
    try:
        docs = await asyncio.to_thread(_find_activity, activity, query, limit)
    except PyMongoError as exc:
        raise DependencyUnavailable("mongo unavailable") from exc

    page = docs[:limit]
    next_cursor = _encode_cursor(page[-1]) if len(docs) > limit else None
    items = [
        {
            "id": doc["_id"],
            "eventId": doc.get("eventId"),
            "type": doc.get("type"),
            "userId": doc.get("userId"),
            "summary": doc.get("summary"),
            "occurredAt": _iso(doc.get("occurredAt")),
        }
        for doc in page
    ]
    return {"items": items, "nextCursor": next_cursor}


@app.get("/api/v1/events/{eventId}/votes-per-minute")
async def get_votes_per_minute(
    request: Request,
    eventId: str,
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
) -> dict[str, Any]:
    """Votes/points per minute (Mongo aggregation, projections only)."""
    event_id = _parse_uuid(eventId, "eventId")
    start = _parse_datetime(from_, "from")
    end = _parse_datetime(to, "to")
    if start and end and start > end:
        raise ValidationFailed("from must be before to")
    activity = _activity_of(request)
    try:
        rows = await asyncio.to_thread(
            _aggregate_votes, activity, {"eventId": event_id, "type": "vote.cast"}, start, end
        )
    except PyMongoError as exc:
        raise DependencyUnavailable("mongo unavailable") from exc
    return {
        "eventId": event_id,
        "series": [
            {"t": _iso(row["_id"]), "votes": row["votes"], "points": row["points"]}
            for row in rows
        ],
    }
