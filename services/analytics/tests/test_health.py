from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_healthz_is_ok() -> None:
    resp = client.get("/healthz")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_readyz_ready_with_checks_list() -> None:
    resp = client.get("/readyz")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ready"
    assert isinstance(body["checks"], list)


def test_metrics_prometheus_exposition() -> None:
    resp = client.get("/metrics")
    assert resp.status_code == 200
    assert "# HELP" in resp.text
