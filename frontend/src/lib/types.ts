export type DailySpendPoint = { day: number; spend: number };

export type DailySpendSeries = {
  bank: string;
  points: DailySpendPoint[];
};

export type DashboardOverview = {
  summary: {
    portfolio_net: number;
    current_month_spend: number;
    previous_month_spend: number;
    spend_delta_pct: number | null;
    /** Selected banks excluded from portfolio_net because they open after the focus month. */
    missing_opening_banks: string[];
  };
  trend: {
    months: number;
    points: Array<{ month_label: string; spend: number }>;
  };
  recent: {
    items: Transaction[];
  };
  highlights: {
    top_category: { category: string | null; spend: number };
    total_inflow: number;
    total_outflow: number;
    current_month_investments: number;
  };
  daily_spend: {
    month_label: string;
    total: number;
    /** One series per bank with spend in the focus month. */
    series: DailySpendSeries[];
  };
  category_spend: {
    items: Array<{ category: string; spend: number; prev_spend: number; txn_count: number }>;
  };
  /** All profile banks (active + inactive) — drives the dashboard bank filter. */
  active_banks: string[];
  /** One row per profile bank; dates are null when the bank has no transactions. */
  freshness: BankFreshness[];
};

export type MonthlyInsight = {
  sentence: string;
  facts: {
    category: string;
    txn_count: number;
    month_start: string;
    month_end: string;
    spend: number;
    prev_spend: number;
    delta_pct: number | null;
  };
  questions: string[];
  generated_at: string;
};

export type BankFreshness = {
  bank: string;
  last_transaction_date: string | null;
  last_added_at: string | null;
};

export type Transaction = {
  id: string;
  amount: number;
  is_debit: boolean;
  category: string;
  bank: string | null;
  payment_method: string | null;
  transaction_date: string;
  description: string | null;
  created_at?: string;
  updated_at?: string;
  version_no?: number;
};

export type SearchResult = {
  total: number;
  page: number;
  page_size: number;
  items: Transaction[];
};

export type Category = {
  name: string;
  is_system: boolean;
  monthly_limit: number | null;
};

export type TrackerConfig = {
  categories: Category[];
  payment_methods: string[];
  /** Active profile bank names — used for transaction entry + import dropdowns. */
  banks: string[];
  /** All known institutions (SBI / Kotak / Slice) for the "add bank" picker. */
  bank_catalog: string[];
};

export type ProfileBank = {
  bank: string;
  opening_balance: number;
  /** Opening month as YYYY-MM. */
  opening_month: string;
  is_active: boolean;
};

export type BankSetup = {
  catalog: string[];
  banks: ProfileBank[];
  /** Banks found on existing transactions but not yet on the profile (soft migrate). */
  suggested_banks: string[];
};

export type ChatReply = {
  reply: string;
  thread_id: string;
};
