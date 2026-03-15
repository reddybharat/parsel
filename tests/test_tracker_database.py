import pytest

from tracker import database


class DummyCursor:
    def __init__(self, rows=None, rowcount: int = 0):
        self._rows = rows or []
        self.rowcount = rowcount
        self._executed = []

    def execute(self, sql, params=None):
        self._executed.append((sql, params))

    def fetchall(self):
        return self._rows

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class DummyConnection:
    def __init__(self, cursor: DummyCursor):
        self._cursor = cursor
        self.committed = False
        self.rolled_back = False
        self.closed = False

    def cursor(self, cursor_factory=None):
        return self._cursor

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True

    def close(self):
        self.closed = True


@contextmanager
def _dummy_connection(rows=None, rowcount: int = 0):
    cur = DummyCursor(rows=rows, rowcount=rowcount)
    conn = DummyConnection(cur)
    try:
        yield conn
    finally:
        conn.close()


def test_get_database_url_raises_when_missing_env(monkeypatch):
    monkeypatch.setattr(database, "_DATABASE_URL", None)
    monkeypatch.delenv("DATABASE_URL", raising=False)

    with pytest.raises(ValueError):
        database._get_database_url()


def test_execute_query_returns_rows():
    rows = [{"id": 1, "amount": 100}]
    with _dummy_connection(rows=rows) as conn:
        result = database.execute_query("SELECT * FROM transactions", conn=conn)
    assert result == [{"id": 1, "amount": 100}]


def test_execute_insert_returns_rows():
    rows = [{"id": 1, "amount": 200}]
    with _dummy_connection(rows=rows) as conn:
        inserted = database.execute_insert("INSERT ... RETURNING *", conn=conn)
    assert inserted == [{"id": 1, "amount": 200}]


def test_execute_update_delete_returns_rowcount():
    with _dummy_connection(rowcount=3) as conn:
        affected = database.execute_update_delete("UPDATE ...", conn=conn)
    assert affected == 3


def test_execute_query_raises_when_conn_missing():
    with pytest.raises(ValueError, match="Database connection unavailable"):
        database.execute_query("SELECT 1")

