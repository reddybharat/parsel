"""Setup step 5: write backend/.env if it is missing, then create or upgrade the database.

Run with the venv's Python from the repo root (the setup scripts do this).
"""

import secrets
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
ENV_FILE = BACKEND_DIR / ".env"
_JWT_SECRET_BYTES = 48
_GROQ_KEYS_URL = "https://console.groq.com/keys"


def _ask_groq_key() -> str:
    print(f"      The chat assistant needs a free Groq API key from {_GROQ_KEYS_URL}")
    print("      Paste it and press Enter, or just press Enter to skip. Everything else works without it.")
    try:
        return input("      Groq API key: ").strip()
    except EOFError:
        return ""


def _write_env_if_missing() -> None:
    if ENV_FILE.exists():
        print("      settings: backend/.env already exists, kept as is")
        return
    groq_key = _ask_groq_key()
    ENV_FILE.write_text(
        f"JWT_SECRET={secrets.token_urlsafe(_JWT_SECRET_BYTES)}\nGROQ_API_KEY={groq_key}\n",
        encoding="utf-8",
    )
    print("      settings: wrote backend/.env (add a Groq key there later if you skipped it)")


def main() -> int:
    _write_env_if_missing()

    sys.path.insert(0, str(BACKEND_DIR))
    from dotenv import load_dotenv

    load_dotenv(ENV_FILE)
    from common.database import init_database

    try:
        db_path = init_database()
    except RuntimeError as exc:
        print(f"      {exc}")
        return 1
    print(f"      database: {db_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
