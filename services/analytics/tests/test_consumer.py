import json
from datetime import UTC, datetime

from app.consumers.vote_cast import process_record


class FakeRecord:
    def __init__(self, payload: dict, headers: list[tuple[bytes, bytes]] | None = None):
        self.value = json.dumps(payload).encode()
        self.headers = headers or []
        self.key = b"event-1"
        self.topic = "eventista.vote.cast"


class FakeActivity:
    def __init__(self) -> None:
        self.docs: dict[str, dict] = {}

    def update_one(self, flt: dict, update: dict, upsert: bool = False) -> None:
        self.docs[flt["_id"]] = dict(update["$set"])


def _payload() -> dict:
    return {
        "id": "0b7d7c8e-0000-4000-8000-000000000001",
        "type": "vote.cast",
        "occurredAt": "2026-11-08T10:00:00Z",
        "eventId": "3f0a1c2e-0000-4000-8000-000000000000",
        "candidateId": "3f0a1c2e-0000-4000-8000-000000000001",
        "points": 3,
        "userId": "3f0a1c2e-0000-4000-8000-000000000002",
        "correlationId": "req-1",
    }


def test_process_record_upserts_keyed_by_message_id() -> None:
    activity = FakeActivity()
    record = FakeRecord(
        _payload(),
        headers=[
            (b"id", b"0b7d7c8e-0000-4000-8000-000000000001"),
            (b"type", b"vote.cast"),
            (b"correlationId", b"req-1"),
        ],
    )

    process_record(record, activity)
    process_record(record, activity)

    assert len(activity.docs) == 1
    doc = activity.docs["0b7d7c8e-0000-4000-8000-000000000001"]
    assert doc["eventId"] == "3f0a1c2e-0000-4000-8000-000000000000"
    assert doc["points"] == 3
    assert doc["correlationId"] == "req-1"
    assert doc["occurredAt"] == datetime(2026, 11, 8, 10, 0, tzinfo=UTC)


def test_process_record_falls_back_to_payload_id() -> None:
    activity = FakeActivity()
    process_record(FakeRecord(_payload()), activity)
    assert "0b7d7c8e-0000-4000-8000-000000000001" in activity.docs


def test_process_record_without_id_writes_nothing() -> None:
    activity = FakeActivity()
    payload = _payload()
    payload.pop("id")
    process_record(FakeRecord(payload), activity)
    assert activity.docs == {}
