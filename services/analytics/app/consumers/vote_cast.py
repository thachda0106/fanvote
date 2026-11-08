"""`vote.cast` consumer (T1.5): writes an activity doc to Mongo keyed by the
event-message id (B6 idempotency — upsert on _id), manual commit after the
side-effect, and links the consumer span to the producer trace via W3C
`traceparent` in the Kafka record headers (T1.4)."""

from __future__ import annotations

import asyncio
import json
import os
from datetime import UTC, datetime
from typing import Any

import structlog
from aiokafka import AIOKafkaConsumer
from opentelemetry import trace
from opentelemetry.propagate import extract
from opentelemetry.trace import SpanKind

from app.observability.metrics import kafka_messages_consumed

logger = structlog.get_logger(service="analytics")

TOPIC = "eventista.vote.cast"
GROUP_ID = "analytics"


def _headers_to_carrier(headers: Any) -> dict[str, str]:
    carrier: dict[str, str] = {}
    for key, value in headers or []:
        if isinstance(key, bytes):
            key = key.decode("utf-8", errors="replace")
        if isinstance(value, bytes):
            value = value.decode("utf-8", errors="replace")
        carrier[key.lower()] = value
    return carrier


def parse_occurred_at(value: object) -> datetime:
    """Stored as a real datetime so sort/aggregate are correct in Mongo."""
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return datetime.now(UTC)
        return parsed.astimezone(UTC) if parsed.tzinfo else parsed.replace(tzinfo=UTC)
    return datetime.now(UTC)


def process_record(record: Any, activity: Any) -> None:
    """Handle one vote.cast record: extract trace, upsert doc, idempotent."""
    carrier = _headers_to_carrier(record.headers)
    parent_ctx = extract(carrier)
    tracer = trace.get_tracer("analytics.vote_cast")
    payload = json.loads(record.value or b"{}")
    message_id = carrier.get("id") or payload.get("id")
    if not message_id:
        logger.warning("vote_cast.missing_id", topic=record.topic)
        return

    key = record.key
    if isinstance(key, bytes):
        key = key.decode("utf-8", errors="replace")

    with tracer.start_as_current_span(
        "vote.cast process",
        context=parent_ctx,
        kind=SpanKind.CONSUMER,
        attributes={
            "messaging.system": "kafka",
            "messaging.destination.name": record.topic,
            "messaging.kafka.message.key": key or "",
        },
    ) as span:
        trace_id = span.get_span_context().trace_id
        doc = {
            "eventId": payload.get("eventId"),
            "type": "vote.cast",
            "userId": payload.get("userId"),
            "candidateId": payload.get("candidateId"),
            "points": payload.get("points"),
            "summary": f"{payload.get('points', 0)} pts cast",
            "occurredAt": parse_occurred_at(payload.get("occurredAt")),
            "traceId": format(trace_id, "032x") if trace_id else None,
            "correlationId": (
                carrier.get("correlationid")
                or payload.get("correlationId")
                or carrier.get("x-request-id")
            ),
        }
        # Filter fields seed the inserted doc on upsert; _id stays immutable.
        activity.update_one({"_id": message_id}, {"$set": doc}, upsert=True)
        logger.info(
            "vote_cast.processed",
            message_id=message_id,
            event_id=payload.get("eventId"),
        )
        kafka_messages_consumed.labels(topic=TOPIC, outcome="success").inc()


async def run_consumer(stop: asyncio.Event, mongo: Any) -> None:
    """Consume until `stop` is set. Failed records re-raise so the supervisor
    restarts from the last committed offset (at-least-once, no loss)."""
    brokers = os.getenv("KAFKA_BROKERS", "localhost:19095")
    activity = mongo["analytics"]["activity"]
    activity.create_index("eventId")

    consumer = AIOKafkaConsumer(
        TOPIC,
        bootstrap_servers=brokers.split(","),
        group_id=GROUP_ID,
        enable_auto_commit=False,
        auto_offset_reset="earliest",
    )
    await consumer.start()
    logger.info("kafka.consumer.started", topic=TOPIC, group=GROUP_ID)
    try:
        while not stop.is_set():
            try:
                batch = await asyncio.wait_for(consumer.getmany(timeout_ms=200), 1)
            except TimeoutError:
                continue
            for records in batch.values():
                for record in records:
                    try:
                        process_record(record, activity)
                        await consumer.commit()
                    except Exception:  # noqa: BLE001
                        kafka_messages_consumed.labels(
                            topic=TOPIC, outcome="error"
                        ).inc()
                        logger.exception("vote_cast.process_failed")
                        raise
    finally:
        await consumer.stop()
        logger.info("kafka.consumer.stopped")
