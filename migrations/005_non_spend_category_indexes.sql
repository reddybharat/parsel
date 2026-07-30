-- 005_non_spend_category_indexes.sql
-- Keep dashboard partial indexes aligned with non-spend categories.

DROP INDEX IF EXISTS public.idx_transactions_user_dashboard_spend;
DROP INDEX IF EXISTS public.idx_transactions_user_month_start;

CREATE INDEX idx_transactions_user_dashboard_spend
  ON public.transactions (user_id, transaction_date)
  WHERE is_debit = TRUE
    AND category NOT IN ('Investments', 'Self Transfer', 'Wallet Top-up');

CREATE INDEX idx_transactions_user_month_start
  ON public.transactions (user_id, date_trunc('month', transaction_date::timestamp))
  WHERE is_debit = TRUE
    AND category NOT IN ('Investments', 'Self Transfer', 'Wallet Top-up');

ANALYZE public.transactions;
