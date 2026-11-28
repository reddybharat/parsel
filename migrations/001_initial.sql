-- 001_initial.sql
-- Parsel schema for SQLite: the final state of the old PostgreSQL migrations 001-009.
-- Applied automatically at startup by init_database() (backend/common/database.py).
-- Never edit a released migration; add the next NNN_*.sql instead.
--
-- Storage: uuid ids as dashed text, money as REAL, dates as 'YYYY-MM-DD',
-- timestamps as UTC 'YYYY-MM-DD HH:MM:SS[.ffffff]', booleans as 0/1, JSON as text.

CREATE TABLE users (
  id                   TEXT PRIMARY KEY,
  username             TEXT NOT NULL UNIQUE,
  email                TEXT NOT NULL UNIQUE,
  password_hash        TEXT NOT NULL,
  first_name           TEXT,
  last_name            TEXT,
  preferences          TEXT NOT NULL DEFAULT '{"theme":"light","custom_categories":[]}',
  is_active            INTEGER NOT NULL DEFAULT 1,
  created_at           TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  password_changed_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at        TEXT,
  version_no           INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE transactions (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users (id),
  amount           REAL NOT NULL CHECK (amount > 0),
  is_debit         INTEGER NOT NULL,
  category         TEXT NOT NULL,
  payment_method   TEXT,
  bank             TEXT,
  transaction_date TEXT NOT NULL,
  description      TEXT,
  created_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  version_no       INTEGER NOT NULL DEFAULT 0
);

-- Ledger search: user + date range, default sort (transaction_date, created_at).
CREATE INDEX idx_transactions_user_date
  ON transactions (user_id, transaction_date DESC, created_at DESC);

CREATE INDEX idx_transactions_user_category_date
  ON transactions (user_id, category, transaction_date DESC);

CREATE INDEX idx_transactions_user_payment_date
  ON transactions (user_id, payment_method, transaction_date DESC);

CREATE INDEX idx_transactions_user_bank_date
  ON transactions (user_id, bank, transaction_date DESC);

-- Dashboard spend aggregates (non-spend categories excluded).
CREATE INDEX idx_transactions_user_dashboard_spend
  ON transactions (user_id, transaction_date)
  WHERE is_debit = TRUE
    AND category NOT IN ('Investments', 'Self Transfer', 'Wallet Top-up');

-- Per-user bank profile with an opening balance seed. Opening balance is the cash
-- on the 1st of opening_month; later closing balances are computed, never stored.
CREATE TABLE user_banks (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users (id),
  bank            TEXT NOT NULL,
  opening_balance REAL NOT NULL DEFAULT 0 CHECK (opening_balance >= 0),
  opening_month   TEXT NOT NULL,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  version_no      INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT uq_user_banks_user_bank UNIQUE (user_id, bank),
  CONSTRAINT ck_user_banks_opening_month_first
    CHECK (opening_month = date(opening_month, 'start of month'))
);

CREATE INDEX idx_user_banks_user_active
  ON user_banks (user_id, is_active);

-- Cache for the Overview "Insight of the month": one row per user and month.
-- fingerprint = count + latest updated_at of the transactions the insight was
-- built from; a changed fingerprint means the row is stale and gets regenerated.
CREATE TABLE monthly_insights (
  user_id      TEXT NOT NULL REFERENCES users (id),
  month        TEXT NOT NULL,
  fingerprint  TEXT NOT NULL,
  sentence     TEXT NOT NULL,
  facts        TEXT NOT NULL,
  questions    TEXT NOT NULL,
  generated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, month),
  CONSTRAINT ck_monthly_insights_month_first
    CHECK (month = date(month, 'start of month'))
);
