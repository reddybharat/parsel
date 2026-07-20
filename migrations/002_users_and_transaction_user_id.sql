-- 002_users_and_transaction_user_id.sql
-- Multi-user auth: users (uuid, username, email, profile, preferences) + transactions.user_id.
--
-- Prerequisites: 001_initial_transactions.sql (or an existing transactions table).
--
-- Steps:
--   1) Run STEP A.
--   2) Start the API and register via UI /register (or POST /auth/register).
--   3) Note your users.id (UUID), then uncomment and run STEP B with that id.
--      If transactions is empty, skip the UPDATE and still run SET NOT NULL + FK.
--   4) Optional: uncomment STEP C to seed first_name / last_name / preferences for one user.

-- =============================================================================
-- STEP A — create users + add nullable user_id
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.users (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username             text NOT NULL UNIQUE,
  email                text NOT NULL UNIQUE,
  password_hash        text NOT NULL,
  first_name           text,
  last_name            text,
  preferences          jsonb NOT NULL DEFAULT '{"theme":"light"}'::jsonb,
  is_active            boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  password_changed_at  timestamptz NOT NULL DEFAULT now(),
  last_login_at        timestamptz,
  version_no           integer NOT NULL DEFAULT 0
);

-- Upgrade path when users already exists from an earlier 002 without profile columns
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{"theme":"light"}'::jsonb;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE INDEX IF NOT EXISTS idx_transactions_user_id
  ON public.transactions (user_id);

-- =============================================================================
-- STEP B — backfill all existing transactions to the user you just registered,
-- then enforce NOT NULL + FK.
--
-- 1) Register in the app (UI /register).
-- 2) Replace YOUR_USERNAME below with that username.
-- 3) Uncomment and run this whole block.
-- =============================================================================

-- UPDATE public.transactions
-- SET user_id = (
--   SELECT id FROM public.users WHERE username = 'YOUR_USERNAME'
-- )
-- WHERE user_id IS NULL;

-- -- Optional: confirm before locking the column
-- -- SELECT user_id, COUNT(*) FROM public.transactions GROUP BY user_id;

-- ALTER TABLE public.transactions
--   ALTER COLUMN user_id SET NOT NULL;

-- ALTER TABLE public.transactions
--   DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;

-- ALTER TABLE public.transactions
--   ADD CONSTRAINT transactions_user_id_fkey
--   FOREIGN KEY (user_id) REFERENCES public.users(id);

-- =============================================================================
-- STEP C — optional: backfill profile + preferences for one existing user
--
-- Replace YOUR_USERNAME and name/theme values, then uncomment and run.
-- =============================================================================

-- UPDATE public.users
-- SET
--   first_name = 'Bharat',
--   last_name = 'Reddy',
--   preferences = '{"theme":"dark"}'::jsonb,
--   version_no = version_no + 1,
--   updated_at = now()
-- WHERE username = 'YOUR_USERNAME';

-- SELECT id, username, email, first_name, last_name, preferences, version_no
-- FROM public.users
-- WHERE username = 'YOUR_USERNAME';
