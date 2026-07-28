export type DashboardOverview = {
  summary: {
    portfolio_net: number;
    current_month_spend: number;
    previous_month_spend: number;
    spend_delta_pct: number | null;
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
    points: Array<{ day: number; spend: number }>;
  };
  category_spend: {
    items: Array<{ category: string; spend: number }>;
  };
};

export type Transaction = {
  id: string;
  amount: number;
  is_debit: boolean;
  category: string;
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
};

export type TrackerConfig = {
  categories: Category[];
  payment_methods: string[];
};

export type ChatReply = {
  reply: string;
  thread_id: string;
};
