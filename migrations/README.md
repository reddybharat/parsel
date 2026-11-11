# Database migrations

Hand-applied SQL scripts (no migration runner). Run `001`–`007` as `parsel` (the `DATABASE_URL` login) against the `parsel` database; `008` runs as `postgres`.

Commands are Windows `cmd`, run from the repo root with the Postgres tools on `PATH` (see the [main README](../README.md#prerequisites)). Create the `parsel` role and database first ([First-time setup](../README.md#1-database)).

| File | Purpose |
|---|---|
| [001_initial_transactions.sql](001_initial_transactions.sql) | Original baseline: `transactions` table + indexes (pre-auth) |
| [002_users_and_transaction_user_id.sql](002_users_and_transaction_user_id.sql) | Multi-user: `users` (uuid, username, email, optional names, JSONB preferences) + `transactions.user_id` |
| [003_search_indexes.sql](003_search_indexes.sql) | Ledger search: user-scoped composite indexes, `pg_trgm` trigram indexes for free-text `q` |
| [004_user_custom_categories.sql](004_user_custom_categories.sql) | Update `users.preferences` default to include `custom_categories` |
| [005_non_spend_category_indexes.sql](005_non_spend_category_indexes.sql) | Exclude global non-spend categories from dashboard spend indexes |
| [006_transaction_bank.sql](006_transaction_bank.sql) | Optional `transactions.bank` label (SBI / Kotak / Slice enforced in app) + `(user_id, bank, transaction_date)` index |
| [007_user_banks.sql](007_user_banks.sql) | Per-user `user_banks` profile: opening balance seed + opening month + active flag; drives closing-balance portfolio and bank dropdowns |
| [008_chat_agent_role.sql](008_chat_agent_role.sql) | Read-only `parsel_agent` login for the chat agent (`CHAT_DATABASE_URL`): `SELECT` on `transactions` only. Run as a superuser, then `\password parsel_agent` |

## Fresh database

```cmd
psql -U parsel -d parsel -f migrations\001_initial_transactions.sql
psql -U parsel -d parsel -f migrations\002_users_and_transaction_user_id.sql
psql -U parsel -d parsel -f migrations\003_search_indexes.sql
psql -U parsel -d parsel -f migrations\004_user_custom_categories.sql
psql -U parsel -d parsel -f migrations\005_non_spend_category_indexes.sql
psql -U parsel -d parsel -f migrations\006_transaction_bank.sql
psql -U parsel -d parsel -f migrations\007_user_banks.sql
psql -U postgres -d parsel -f migrations\008_chat_agent_role.sql
psql -U postgres -c "\password parsel_agent"
```

Then:

1. Start the API and open `/register` (or `POST /auth/register`).
2. If you already have transaction rows, open `002`, uncomment **STEP B**, set `user_id = '<your users.id uuid>'`, and run those statements.
3. If `transactions` is empty, uncomment STEP B without needing a meaningful `UPDATE` (or run `ALTER ... SET NOT NULL` + FK only after the table is empty / all rows have `user_id`).
4. Optional: uncomment **STEP C** in `002` to seed `first_name` / `last_name` / `preferences` for one user.

## Restore from a backup

Use this instead of [Fresh database](#fresh-database) when you have a backup. The `parsel` role and an empty `parsel` database must exist.

**From a `.dump` file** (made with `pg_dump -Fc`, see [Backups](#backups)):

```cmd
pg_restore -U parsel -d parsel --no-owner --no-privileges --exit-on-error "%USERPROFILE%\parsel-backups\parsel_YYYY-MM-DD.dump"
psql -U postgres -d parsel -f migrations\008_chat_agent_role.sql
psql -U postgres -c "\password parsel_agent"
```

`--no-owner --no-privileges` makes `parsel` own everything; `008` then re-creates the agent login and its grant. Roles are server-wide and never inside a dump.

**From a plain SQL dump of another server** (e.g. a hosted Postgres, dumped with `pg_dump "<url>" --schema=public --no-owner --no-privileges -f supabase_public.sql`):

1. Check where `pg_trgm` lives: `findstr /N "gin_trgm_ops" supabase_public.sql`. `public.gin_trgm_ops` means run `psql -U postgres -d parsel -c "CREATE EXTENSION pg_trgm;"` first (`--schema=public` dumps leave extensions out).
2. Delete these lines from the file if present: `CREATE SCHEMA public;` (already exists locally) and any `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`, `CREATE POLICY` or trigger referencing `auth.*`. Row-level security with no policies hides every row from `parsel_agent`.
3. Restore as `parsel` so it owns every object, then apply `008`:

```cmd
psql -U postgres -d parsel -v ON_ERROR_STOP=1 --single-transaction -c "SET ROLE parsel;" -f supabase_public.sql
psql -U postgres -d parsel -f migrations\008_chat_agent_role.sql
psql -U postgres -c "\password parsel_agent"
```

Compare row counts against the source before pointing `DATABASE_URL` at the new database:

```cmd
psql -U parsel -d parsel -c "select (select count(*) from users) u, (select count(*) from transactions) t, (select count(*) from user_banks) b;"
```

## Existing database (already has `transactions` from 001)

```cmd
psql -U parsel -d parsel -f migrations\002_users_and_transaction_user_id.sql
```

Register a user, then run the commented **STEP B** block in `002` with your `users.id`.

Apply later scripts (`003`–`008`) in order if they are not already applied.

## Search indexes (`003`)

Apply anytime after `002` (indexes only; safe to re-run). `pg_trgm` is a trusted extension (PostgreSQL 13+), so the database owner `parsel` can create it; without it, free-text `q` still works via sequential scan. Commented `DROP`s at the end of `003` remove superseded pre-auth indexes — confirm with `EXPLAIN ANALYZE` first.

Re-running `002` is safe: `CREATE TABLE IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` add profile columns (`first_name`, `last_name`, `preferences`) when upgrading an older `users` table.

## Transaction bank (`006`)

Adds nullable `transactions.bank`. New creates and imports require a bank from the allowlist in `backend/tracker/constants.py` (`SBI`, `Kotak`, `Slice`). Existing rows may stay `NULL` until edited. Safe to re-run (`ADD COLUMN IF NOT EXISTS`).

Optional check after applying:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'bank';
```

## User banks (`007`)

Adds `public.user_banks` (one row per `(user_id, bank)`), the per-user bank profile. Each row holds an `opening_balance` (>= 0) as of the 1st of `opening_month`, plus an `is_active` flag. The dashboard "Net Portfolio Balance" is the sum of each covered bank's closing balance (opening + signed transactions through the focus month). Safe to re-run (`CREATE TABLE IF NOT EXISTS`). Existing users are prompted to complete their banks on next login (soft migrate); no rows are auto-created.

## Backups

Manual. After each import session:

```cmd
mkdir "%USERPROFILE%\parsel-backups"
pg_dump -U parsel -Fc parsel -f "%USERPROFILE%\parsel-backups\parsel_YYYY-MM-DD.dump"
```

Then copy the file somewhere off the machine (e.g. Google Drive). The files are unencrypted.

Prove a backup restores, into a scratch database:

```cmd
createdb -U postgres -O parsel parsel_restore_test
pg_restore -U parsel -d parsel_restore_test --no-owner --no-privileges --exit-on-error "%USERPROFILE%\parsel-backups\parsel_YYYY-MM-DD.dump"
psql -U parsel -d parsel_restore_test -c "select count(*) from transactions;"
dropdb -U postgres parsel_restore_test
```

Restore over the live database (stop the backend first):

```cmd
pg_restore -U parsel -d parsel --clean --if-exists "%USERPROFILE%\parsel-backups\parsel_YYYY-MM-DD.dump"
```

## Check

```sql
SELECT id, username, email, first_name, last_name, preferences, created_at FROM public.users;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;
```
