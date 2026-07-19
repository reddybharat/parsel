import os

import pytest

# Required by JWT helpers when auth routes/tests create tokens.
os.environ.setdefault("JWT_SECRET", "test-secret-key-for-pytest-only!!")


@pytest.fixture
def anyio_backend():
    return "asyncio"
