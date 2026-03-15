from datetime import date

from tracker import services


def test_transactions_csv_template_has_header_and_rows():
    csv_text = services.transactions_csv_template()
    lines = [line for line in csv_text.splitlines() if line.strip()]
    assert lines[0].split(",") == services.CSV_FIELDS
    # Should contain example rows
    assert len(lines) > 1


def test_export_transactions_csv_builds_csv(monkeypatch):
    # Fake some rows returned from the database
    fake_rows = [
        {
            "transaction_date": date(2026, 3, 1),
            "category": "Grocery",
            "amount": 1000,
            "description": "Test",
        }
    ]

    def fake_execute_query(sql, params=None, conn=None):
        return fake_rows

    monkeypatch.setattr(services, "execute_query", fake_execute_query)

    class DummyConn:
        pass

    csv_text = services.export_transactions_csv(
        start_date=date(2026, 3, 1),
        end_date=date(2026, 3, 31),
        category="All",
        conn=DummyConn(),
    )
    assert "transaction_date,category,amount,description" in csv_text
    assert "Grocery" in csv_text


def test_import_transactions_from_csv_valid():
    class DummyCursor:
        def __init__(self):
            self.executed = []

        def executemany(self, sql, rows):
            self.executed.append((sql, rows))

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    class DummyConnection:
        def __init__(self):
            self.cursor_obj = DummyCursor()

        def cursor(self):
            return self.cursor_obj

        def commit(self):
            pass

        def rollback(self):
            pass

        def close(self):
            pass

    conn = DummyConnection()
    csv_bytes = b"transaction_date,category,amount,description\n2026-03-01,Grocery,1000,Test\n"
    inserted_count, errors = services.import_transactions_from_csv(csv_bytes, conn)
    assert inserted_count == 1
    assert errors == []


def test_import_transactions_from_csv_missing_required_columns():
    class DummyConn:
        pass

    csv_bytes = b"date,category,amount,description\n2026-03-01,Grocery,1000,Test\n"
    inserted_count, errors = services.import_transactions_from_csv(csv_bytes, conn=DummyConn())
    assert inserted_count == 0
    assert any("Missing required column" in e for e in errors)

