import { keepPreviousData } from "@tanstack/react-query";

import { fetchDashboardOverview } from "@/api/dashboard";
import { queryClient } from "@/lib/queryClient";

export const TREND_MONTHS = 12;
export const RECENT_ACTIVITY_LIMIT = 11;

export type DashboardOverviewFilters = {
  /** Focus month as YYYY-MM. */
  month: string;
  /**
   * Selected banks to include.
   * `null` = all banks (default / not yet narrowed).
   */
  banks: string[] | null;
};

export function currentMonthValue(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function formatMonthValueLabel(monthValue: string): string {
  const [yearRaw, monthRaw] = monthValue.split("-");
  const date = new Date(Number(yearRaw), Number(monthRaw) - 1, 1);
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

export function banksFilterKey(banks: string[] | null): string {
  if (!banks || banks.length === 0) return "all";
  return [...banks].sort().join(",");
}

export function dashboardOverviewQueryKey(filters: DashboardOverviewFilters) {
  return [
    "dashboard",
    "overview",
    TREND_MONTHS,
    RECENT_ACTIVITY_LIMIT,
    filters.month,
    banksFilterKey(filters.banks),
  ] as const;
}

export function dashboardOverviewQueryOptions(filters: DashboardOverviewFilters) {
  return {
    queryKey: dashboardOverviewQueryKey(filters),
    queryFn: () =>
      fetchDashboardOverview({
        months: TREND_MONTHS,
        recentLimit: RECENT_ACTIVITY_LIMIT,
        month: filters.month,
        banks: filters.banks,
      }),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  };
}

export function invalidateDashboardOverview() {
  return queryClient.invalidateQueries({ queryKey: ["dashboard"] });
}

export function prefetchDashboardOverview(filters?: Partial<DashboardOverviewFilters>) {
  const resolved: DashboardOverviewFilters = {
    month: filters?.month ?? currentMonthValue(),
    banks: filters?.banks ?? null,
  };
  return queryClient.prefetchQuery(dashboardOverviewQueryOptions(resolved));
}
