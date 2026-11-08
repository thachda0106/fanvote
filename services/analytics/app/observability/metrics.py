"""RED metrics (T1.6) — request count by route+status, latency histogram,
in-flight. Bounded labels only (no event_id/user_id — R-27)."""

from __future__ import annotations

import time
from typing import Any

from prometheus_client import Counter, Gauge, Histogram

SERVICE = "analytics"

http_requests = Counter(
    "http_requests_total",
    "HTTP requests by method, route template and status class",
    ["method", "route", "status_class"],
)
http_duration = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "route"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
)
http_in_flight = Gauge(
    "http_in_flight_requests",
    "HTTP requests currently being served",
)
kafka_messages_consumed = Counter(
    "kafka_messages_consumed_total",
    "Kafka records processed by consumer group",
    ["topic", "outcome"],
)


def status_class(status: int) -> str:
    return f"{status // 100}xx"


def finish(request: Any, status: int, started: float) -> None:
    """Record one completed request; route label is the template, not the path."""
    route = request.scope.get("route")
    route_path = getattr(route, "path", None) or "unmatched"
    method = request.method
    http_requests.labels(
        method=method, route=route_path, status_class=status_class(status)
    ).inc()
    http_duration.labels(method=method, route=route_path).observe(
        time.perf_counter() - started
    )
    http_in_flight.dec()
