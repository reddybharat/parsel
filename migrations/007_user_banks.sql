-- 007_user_banks.sql
-- Per-user bank profile with an opening balance seed.
-- Opening balance is the cash on the 1st of opening_month; later months' closing
-- balances are computed (opening + signed transactions), never stored.
-- Bank names are still enforced against the app catalog (SBI / Kotak / Slice).

CREATE TABLE IF NOT EXISTS public.user_banks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.users (id),
  bank            text NOT NULL,
  opening_balance numeric NOT NULL DEFAULT 0 CHECK (opening_balance >= 0),
  opening_month   date NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  version_no      integer NOT NULL DEFAULT 0,
  CONSTRAINT uq_user_banks_user_bank UNIQUE (user_id, bank),
  -- Opening month must be normalized to the first of the month.
  CONSTRAINT ck_user_banks_opening_month_first CHECK (date_trunc('month', opening_month) = opening_month)
);

CREATE INDEX IF NOT EXISTS idx_user_banks_user_active
  ON public.user_banks (user_id, is_active);
