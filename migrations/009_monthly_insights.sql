-- 009_monthly_insights.sql
-- Cache for the Overview "Insight of the month": one row per user and month.
-- fingerprint = count + latest updated_at of the transactions the insight was
-- built from; a changed fingerprint means the row is stale and gets regenerated.

CREATE TABLE IF NOT EXISTS public.monthly_insights (
  user_id      uuid NOT NULL REFERENCES public.users (id),
  month        date NOT NULL,
  fingerprint  text NOT NULL,
  sentence     text NOT NULL,
  facts        jsonb NOT NULL,
  questions    jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, month),
  -- Month must be normalized to the first of the month.
  CONSTRAINT ck_monthly_insights_month_first CHECK (date_trunc('month', month) = month)
);
