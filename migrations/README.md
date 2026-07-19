# Database migrations

Hand-applied SQL scripts (no migration runner). Run them against the same database as `DATABASE_URL`.

| File | Purpose |
|---|---|
| [001_initial_transactions.sql](001_initial_transactions.sql) | Original baseline: `transactions` table + indexes (pre-auth) |
| [002_users_and_transaction_user_id.sql](002_users_and_transaction_user_id.sql) | Multi-user: `users` (uuid, username, email) + `transactions.user_id` |

## Fresh database

```powershell
psql "postgresql://USER:PASSWORD@localhost:5432/parsel" -f migrations/001_initial_transactions.sql
psql "postgresql://USER:PASSWORD@localhost:5432/parsel" -f migrations/002_users_and_transaction_user_id.sql
```

Then:

1. Start the API and open `/register` (or `POST /auth/register`).
2. If you already have transaction rows, open `002`, uncomment **STEP B**, set `user_id = '<your users.id uuid>'`, and run those statements.
3. If `transactions` is empty, uncomment STEP B without needing a meaningful `UPDATE` (or run `ALTER ... SET NOT NULL` + FK only after the table is empty / all rows have `user_id`).

## Existing database (already has `transactions` from 001)

```powershell
psql "postgresql://USER:PASSWORD@localhost:5432/parsel" -f migrations/002_users_and_transaction_user_id.sql
```

Register a user, then run the commented **STEP B** block in `002` with your `users.id`.

## Check

```sql
SELECT id, username, email, created_at FROM public.users;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'transactions'
ORDER BY ordinal_position;
```
