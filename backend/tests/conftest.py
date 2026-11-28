import os
import tempfile
from pathlib import Path

import pytest

# Required by JWT helpers when auth routes/tests create tokens.
os.environ.setdefault("JWT_SECRET", "test-secret-key-for-pytest-only!!")

# One throwaway SQLite file per test session, set before any engine is created.
os.environ["DATABASE_PATH"] = str(Path(tempfile.mkdtemp(prefix="parsel-tests-")) / "parsel.db")
# Blank (not unset) so load_dotenv() can't bring back a legacy Postgres URL from backend/.env.
os.environ["DATABASE_URL"] = ""

from common.database import init_database  # noqa: E402

init_database()


@pytest.fixture
def anyio_backend():
    return "asyncio"
