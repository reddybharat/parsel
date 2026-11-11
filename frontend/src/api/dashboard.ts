import { getJson } from "./client";
import type { DashboardOverview, MonthlyInsight } from "../lib/types";

export type DashboardOverviewParams = {
  months?: number;
  recentLimit?: number;
  /** Focus month as YYYY-MM. Omit for current month. */
  month?: string;
  /** Selected banks. Omit / empty = all banks. */
  banks?: string[] | null;
};

/** Null when the month has no spend. */
export function fetchMonthlyInsight(month: string) {
  return getJson<MonthlyInsight | null>("/dashboard/insight", { month });
}

export function fetchDashboardOverview({
  months = 12,
  recentLimit = 4,
  month,
  banks,
}: DashboardOverviewParams = {}) {
  return getJson<DashboardOverview>("/dashboard/overview", {
    months,
    recent_limit: recentLimit,
    month,
    banks: banks && banks.length > 0 ? banks.join(",") : undefined,
  });
}
