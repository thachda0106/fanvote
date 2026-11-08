"""Structured JSON logging with request/trace correlation (T1.6)."""

from __future__ import annotations

import logging
import sys

import structlog
from opentelemetry import trace


def _add_trace_context(
    _logger, _method, event_dict: dict
) -> dict:  # noqa: ANN001
    span = trace.get_current_span()
    ctx = span.get_span_context()
    if ctx and ctx.is_valid:
        event_dict.setdefault("trace_id", format(ctx.trace_id, "032x"))
        event_dict.setdefault("span_id", format(ctx.span_id, "016x"))
    event_dict.setdefault("service", "analytics")
    return event_dict


def configure_logging(level: str = "INFO") -> None:
    """JSON logs on stdout; every line carries service + active trace ids."""
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, level.upper(), logging.INFO),
    )
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            _add_trace_context,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, level.upper(), logging.INFO)
        ),
        cache_logger_on_first_use=True,
    )


logger = structlog.get_logger(service="analytics")