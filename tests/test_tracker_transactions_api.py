from contextlib import contextmanager
from datetime import date, datetime, timezone
from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient

from tracker.router import router as transactions_router


def create_app() -> FastAPI:
    app = FastAPI()
    app.include_router(transactions_router)
    return app


@contextmanager
def _dummy_conn_cm():
    yield None


def test_create_transaction_happy_path(monkeypatch):
    app = create_app()

    def fake_execute_insert(sql: str, params: tuple[Any, ...] = None, conn=None):
        now = datetime.now(timezone.utc)
        return [
            {
                "id": 1,
                "amount": params[0],
                "category": params[1],
                "transaction_date": params[2],
                "description": params[3],
                "created_at": now,
                "updated_at": now,
                "version_no": 0,
            }
        ]

    from tracker import api as tracker_api_pkg  # type: ignore[import-untyped]

    monkeypatch.setattr(
        tracker_api_pkg.transactions, "get_connection", _dummy_conn_cm  # type: ignore[attr-defined]
    )
    monkeypatch.setattr(
        tracker_api_pkg.transactions, "execute_insert", fake_execute_insert  # type: ignore[attr-defined]
    )

    client = TestClient(app)
    payload = {
        "amount": 1000,
        "category": "Grocery",
        "transaction_date": date.today().isoformat(),
        "description": "Test",
    }
    resp = client.post("/transactions", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body["amount"] == 1000
    assert body["category"] == "Grocery"


def test_create_transaction_invalid_date(monkeypatch):
    app = create_app()
    client = TestClient(app)

    payload = {
        "amount": 1000,
        "category": "Grocery",
        "transaction_date": "9999-99-99",
        "description": "Test",
    }
    resp = client.post("/transactions", json=payload)
    assert resp.status_code == 422 or resp.status_code == 400


def test_get_transaction_not_found(monkeypatch):
    app = create_app()

    def fake_execute_query(sql: str, params: tuple[Any, ...] = None, conn=None):
        return []

    from tracker import api as tracker_api_pkg  # type: ignore[import-untyped]

    monkeypatch.setattr(
        tracker_api_pkg.transactions, "get_connection", _dummy_conn_cm  # type: ignore[attr-defined]
    )
    monkeypatch.setattr(
        tracker_api_pkg.transactions, "execute_query", fake_execute_query  # type: ignore[attr-defined]
    )

    client = TestClient(app)
    resp = client.get("/transactions/unknown-id")
    assert resp.status_code == 404

