-- 001_initial_transactions.sql
-- Baseline schema before multi-user auth (transactions only).
-- Apply once on a fresh database that has never had Parsel tables.
-- Requires: PostgreSQL with pgcrypto / gen_random_uuid() (usually available by default on PG 13+).

CREATE TABLE public.transactions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount           numeric NOT NULL CHECK (amount > 0),
  is_debit         boolean NOT NULL,
  category         text NOT NULL,
  payment_method   text,
  transaction_date date NOT NULL,
  description      text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  version_no       integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_transactions_transaction_date
  ON public.transactions (transaction_date);

CREATE INDEX IF NOT EXISTS idx_transactions_recent
  ON public.transactions (transaction_date DESC, created_at DESC);

-- Dashboard spend aggregations (debit, non-investment, date range)
CREATE INDEX IF NOT EXISTS idx_transactions_dashboard_spend
  ON public.transactions (transaction_date)
  WHERE is_debit = TRUE AND category <> 'Investments';

-- Monthly trend grouping for dashboard
CREATE INDEX IF NOT EXISTS idx_transactions_month_start
  ON public.transactions (date_trunc('month', transaction_date::timestamp))
  WHERE is_debit = TRUE AND category <> 'Investments';
