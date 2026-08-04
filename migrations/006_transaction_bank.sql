-- 006_transaction_bank.sql
-- Add optional bank label on transactions (SBI / Kotak / Slice enforced in app).
-- Existing rows stay NULL until edited; new creates/imports require bank.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS bank text;

CREATE INDEX IF NOT EXISTS idx_transactions_user_bank_date
  ON public.transactions (user_id, bank, transaction_date DESC);
