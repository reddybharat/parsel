# Database migrations

Parsel stores everything in one SQLite file, `data/parsel.db` at the repo root (override with `DATABASE_PATH` in `backend/.env`). The `data/` folder is gitignored.

Migrations apply themselves. `init_database()` in [`backend/common/database.py`](../backend/common/database.py) runs every time the API starts and every time setup runs:

- Each `NNN_*.sql` file whose number is above the DB's `PRAGMA user_version` runs in its own transaction, in number order, then `user_version` is set to that number. A failing migration rolls back and leaves the version where it was.
- Before running anything on an existing DB, it copies the file to `data/parsel.db.bak-v<old version>`. Only the newest 3 backups are kept. Normal starts with nothing pending copy nothing.

| File | Purpose |
|---|---|
| [001_initial.sql](001_initial.sql) | Full schema: `users`, `transactions`, `user_banks`, `monthly_insights` and their indexes. Same tables and constraints as the old PostgreSQL migrations 001–009 |
| [pg_to_sqlite.py](pg_to_sqlite.py) | One-time copy from an old PostgreSQL install (see [Moving from Postgres](#moving-from-postgres)) |

The old PostgreSQL scripts are in git history (before the SQLite switch) if you ever need them.

## Adding a migration

1. Add `migrations/002_<what>.sql` (next free number). Plain SQLite SQL, no `BEGIN`/`COMMIT` (the runner wraps it).
2. Never edit a migration that has shipped on `release`; add a new one instead.
3. Run `python -m pytest -q` from `backend/` (the test DB applies every migration from scratch), then start the app once against a copy of a real DB.

SQLite can't drop or retype columns in place on old versions; for those, create the new table, copy rows over, drop the old one, and rename, all in the same file.

## Moving from Postgres

For anyone who ran Parsel on PostgreSQL before. Your Postgres data is only read, never changed.

1. Update the code (run setup, or `git pull`).
2. Note your old `DATABASE_URL` from `backend\.env`, then delete the `DATABASE_URL` and `CHAT_DATABASE_URL` lines from that file. Parsel refuses to start while a PostgreSQL `DATABASE_URL` is there.
3. With PostgreSQL still running, from the repo root:

   ```cmd
   venv\Scripts\activate.bat
   pip install asyncpg
   python migrations\pg_to_sqlite.py --from postgresql://parsel:<password>@localhost:5432/parsel
   ```

   It creates `data\parsel.db`, copies `users`, `user_banks`, `transactions` and `monthly_insights` in one transaction, and prints the row count of each table, which it has checked against PostgreSQL. It refuses to run if the SQLite file already has data.
4. Start Parsel and compare a few months of Overview totals with what you saw before.
5. Once you're happy: `pip uninstall asyncpg`. PostgreSQL can be uninstalled whenever you like; keep a last `pg_dump` if you want a fallback.

## Backups

Manual. Stop Parsel (close its window), then copy `data\parsel.db` somewhere safe, for example Google Drive. If `parsel.db-wal` or `parsel.db-shm` files sit next to it, copy those too. The file is not encrypted.

Updates make their own backup before changing the database (`parsel.db.bak-v<N>`, newest 3 kept), but those sit in the same folder, so they don't replace an off-machine copy.

## Restore

**After a bad update:** stop Parsel, then in `data\` rename or delete `parsel.db` (and any `parsel.db-wal` / `parsel.db-shm`), and rename the newest `parsel.db.bak-vN` to `parsel.db`. If the code still expects a newer schema, it re-applies the migrations on the next start, so also go back to the previous code version, or wait for a fix before starting again.

**From your own copy:** stop Parsel and put the copied `parsel.db` (plus its `-wal` / `-shm` files, if you copied any) into `data\`.

## Check

From the repo root, with the venv active:

```cmd
python -c "import sqlite3; c = sqlite3.connect('data/parsel.db'); print('version', c.execute('PRAGMA user_version').fetchone()[0]); print([(t, c.execute(f'select count(*) from {t}').fetchone()[0]) for t in ('users', 'transactions', 'user_banks', 'monthly_insights')])"
```
