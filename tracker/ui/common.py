"""Shared UI helpers for the tracker Streamlit tabs (error messages, connection checks)."""

DATABASE_ERROR_MSG = (
    "**Could not reach the database.** This is usually:\n\n"
    "• **Project paused** — Free-tier Supabase projects pause after inactivity. "
    "Open your [Supabase Dashboard](https://supabase.com/dashboard), select the project, and click **Restore**.\n\n"
    "• **Temporary outage** — Try again in a few minutes.\n\n"
    "• **Network/firewall** — Check VPN or corporate network if the problem continues.\n\n"
    "• **DATABASE_URL** — Ensure .env has a valid DATABASE_URL (PostgreSQL connection string)."
)


def is_db_connection_error(err: str) -> bool:
    """Detect connection/SSL/timeout-style errors from the database."""
    err_lower = err.lower()
    return (
        "525" in err
        or "ssl" in err_lower
        or "connection" in err_lower
        or "timeout" in err_lower
        or "could not connect" in err_lower
        or "operationalerror" in err_lower
    )
