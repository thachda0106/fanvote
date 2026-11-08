"""OTel SDK init (T1.4) — traces exported to the in-cluster collector."""

from __future__ import annotations

import os

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

_provider: TracerProvider | None = None


def init_tracing() -> None:
    """Install a TracerProvider exporting OTLP/HTTP when an endpoint is set.

    Idempotent; safe to call from tests (no endpoint → no-op exporter).
    """
    global _provider
    if _provider is not None:
        return
    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "").rstrip("/")
    resource = Resource.create(
        {
            "service.name": os.getenv("OTEL_SERVICE_NAME", "analytics"),
            "service.version": os.getenv("SERVICE_VERSION", "0.1.0"),
        }
    )
    provider = TracerProvider(resource=resource)
    if endpoint:
        provider.add_span_processor(
            BatchSpanProcessor(
                OTLPSpanExporter(endpoint=f"{endpoint}/v1/traces"),
            )
        )
    trace.set_tracer_provider(provider)
    _provider = provider


def shutdown_tracing() -> None:
    """Flush pending spans on shutdown."""
    global _provider
    if _provider is not None:
        _provider.shutdown()
        _provider = None


def get_tracer(name: str = __name__):
    return trace.get_tracer(name)
