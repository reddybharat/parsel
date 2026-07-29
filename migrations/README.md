# Database migrations

Hand-applied SQL scripts (no migration runner). Run them against the same database as `DATABASE_URL`.

| File | Purpose |
|---|---|
| [001_initial_transactions.sql](001_initial_transactions.sql) | Original baseline: `transactions` table + indexes (pre-auth) |
| [002_users_and_transaction_user_id.sql](002_users_and_transaction_user_id.sql) | Multi-user: `users` (uuid, username, email, optional names, JSONB preferences) + `transactions.user_id` |
| [003_search_indexes.sql](003_search_indexes.sql) | Ledger search: user-scoped composite indexes, `pg_trgm` trigram indexes for free-text `q` |
| [004_user_custom_categories.sql](004_user_custom_categories.sql) | Update `users.preferences` default to include `custom_categories` |

## Fresh database

```powershell
psql "postgresql://USER:PASSWORD@localhost:5432/parsel" -f migrations/001_initial_transactions.sql
psql "postgresql://USER:PASSWORD@localhost:5432/parsel" -f migrations/002_users_and_transaction_user_id.sql
psql "postgresql://USER:PASSWORD@localhost:5432/parsel" -f migrations/003_search_indexes.sql
psql "postgresql://USER:PASSWORD@localhost:5432/parsel" -f migrations/004_user_custom_categories.sql
```

Then:

1. Start the API and open `/register` (or `POST /auth/register`).
2. If you already have transaction rows, open `002`, uncomment **STEP B**, set `user_id = '<your users.id uuid>'`, and run those statements.
3. If `transactions` is empty, uncomment STEP B without needing a meaningful `UPDATE` (or run `ALTER ... SET NOT NULL` + FK only after the table is empty / all rows have `user_id`).
4. Optional: uncomment **STEP C** in `002` to seed `first_name` / `last_name` / `preferences` for one user.

## Existing database (already has `transactions` from 001)

```powershell
psql "postgresql://USER:PASSWORD@localhost:5432/parsel" -f migrations/002_users_and_transaction_user_id.sql
```

Register a user, then run the commented **STEP B** block in `002` with your `users.id`.

## Search indexes (`003`)

Apply anytime after `002` (indexes only; safe to re-run). `CREATE EXTENSION pg_trgm` needs superuser the first time; without it, free-text `q` still works via sequential scan. Commented `DROP`s at the end of `003` remove superseded pre-auth indexes — confirm with `EXPLAIN ANALYZE` first.

Re-running `002` is safe: `CREATE TABLE IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` add profile columns (`first_name`, `last_name`, `preferences`) when upgrading an older `users` table.

## Check

```sql
SELECT id, username, email, first_name, last_name, preferences, created_at FROM public.users;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;
```
