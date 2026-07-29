-- 003_search_indexes.sql
-- Ledger search: user-scoped composites + pg_trgm for free-text `q`.
-- Safe to re-run (IF NOT EXISTS throughout).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Core search: user + date range, default sort (transaction_date, created_at).
CREATE INDEX IF NOT EXISTS idx_transactions_user_date
  ON public.transactions (user_id, transaction_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_user_category_date
  ON public.transactions (user_id, category, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_user_payment_date
  ON public.transactions (user_id, payment_method, transaction_date DESC);

-- Free-text `q` (description OR category OR payment_method).
CREATE INDEX IF NOT EXISTS idx_transactions_description_trgm
  ON public.transactions USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_transactions_category_trgm
  ON public.transactions USING gin (category gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_transactions_payment_method_trgm
  ON public.transactions USING gin (payment_method gin_trgm_ops);

-- User-scoped dashboard aggregates (001's partial indexes omitted user_id).
CREATE INDEX IF NOT EXISTS idx_transactions_user_dashboard_spend
  ON public.transactions (user_id, transaction_date)
  WHERE is_debit = TRUE AND category <> 'Investments';

CREATE INDEX IF NOT EXISTS idx_transactions_user_month_start
  ON public.transactions (user_id, date_trunc('month', transaction_date::timestamp))
  WHERE is_debit = TRUE AND category <> 'Investments';

ANALYZE public.transactions;

-- Superseded pre-auth indexes from 001. Drop after EXPLAIN ANALYZE confirms:
-- DROP INDEX IF EXISTS public.idx_transactions_transaction_date;
-- DROP INDEX IF EXISTS public.idx_transactions_recent;
-- DROP INDEX IF EXISTS public.idx_transactions_dashboard_spend;
-- DROP INDEX IF EXISTS public.idx_transactions_month_start;
-- DROP INDEX IF EXISTS public.idx_transactions_user_id;
