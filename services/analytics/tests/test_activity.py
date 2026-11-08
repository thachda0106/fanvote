from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

EVENT_ID = "3f0a1c2e-0000-4000-8000-000000000000"


class FakeCursor:
    def __init__(self, docs: list[dict]) -> None:
        self.docs = list(docs)

    def sort(self, *_args) -> "FakeCursor":
        return self

    def limit(self, n: int) -> "FakeCursor":
        self.docs = self.docs[:n]
        return self

    def __iter__(self):
        return iter(self.docs)


class FakeCollection:
    def __init__(self, docs: list[dict] | None = None, series: list[dict] | None = None):
        self.docs = docs or []
        self.series = series or []
        self.find_query: dict | None = None

    def find(self, query: dict) -> FakeCursor:
        self.find_query = query
        return FakeCursor(self.docs)

    def aggregate(self, pipeline: list[dict]) -> list[dict]:
        return self.series


@pytest.fixture
def fake_activity():
    collection = FakeCollection(
        docs=[
            {
                "_id": "evt-2",
                "eventId": EVENT_ID,
                "type": "vote.cast",
                "userId": "user-1",
                "summary": "3 pts cast",
                "occurredAt": datetime(2026, 11, 8, 10, 1, tzinfo=UTC),
            }
        ],
        series=[
            {"_id": datetime(2026, 11, 8, 10, 0, tzinfo=UTC), "votes": 2, "points": 5},
        ],
    )
    app.state.activity = collection
    yield collection
    del app.state.activity


def test_activity_feed_returns_page(fake_activity) -> None:
    resp = client.get(f"/api/v1/events/{EVENT_ID}/activity")
    assert resp.status_code == 200
    body = resp.json()
    assert body["items"][0]["id"] == "evt-2"
    assert body["items"][0]["occurredAt"] == "2026-11-08T10:01:00Z"
    assert body["nextCursor"] is None
    assert fake_activity.find_query == {"eventId": EVENT_ID}


def test_activity_feed_rejects_bad_uuid(fake_activity) -> None:
    resp = client.get("/api/v1/events/not-a-uuid/activity")
    assert resp.status_code == 400
    assert resp.json()["code"] == "VALIDATION_FAILED"


def test_activity_feed_rejects_bad_cursor(fake_activity) -> None:
    resp = client.get(f"/api/v1/events/{EVENT_ID}/activity?cursor=bogus")
    assert resp.status_code == 400
    assert resp.json()["code"] == "VALIDATION_FAILED"


def test_activity_feed_degrades_without_mongo() -> None:
    resp = client.get(f"/api/v1/events/{EVENT_ID}/activity")
    assert resp.status_code == 503
    assert resp.json()["code"] == "DEPENDENCY_UNAVAILABLE"


def test_votes_per_minute_series(fake_activity) -> None:
    resp = client.get(f"/api/v1/events/{EVENT_ID}/votes-per-minute")
    assert resp.status_code == 200
    body = resp.json()
    assert body["eventId"] == EVENT_ID
    assert body["series"] == [
        {"t": "2026-11-08T10:00:00Z", "votes": 2, "points": 5},
    ]
