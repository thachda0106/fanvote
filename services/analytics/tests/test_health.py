import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


class _Admin:
    def command(self, name: str) -> dict[str, int]:
        return {"ok": 1}


class _Mongo:
    admin = _Admin()


@pytest.fixture
def healthy_state():
    app.state.mongo = _Mongo()
    app.state.consumer_ok = True
    yield
    del app.state.mongo
    del app.state.consumer_ok


def test_healthz_is_ok() -> None:
    resp = client.get("/healthz")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_readyz_degrades_without_mongo() -> None:
    resp = client.get("/readyz")
    assert resp.status_code == 503
    body = resp.json()
    assert body["status"] == "degraded"
    assert {"name": "mongo", "ok": False} in body["checks"]


def test_readyz_ready_with_mongo_and_consumer(healthy_state) -> None:
    resp = client.get("/readyz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ready"
    assert {"name": "mongo", "ok": True} in body["checks"]
    assert {"name": "kafka-consumer", "ok": True} in body["checks"]


def test_metrics_prometheus_exposition() -> None:
    resp = client.get("/metrics")
    assert resp.status_code == 200
    assert "# HELP" in resp.text
    assert "http_requests_total" in resp.text
