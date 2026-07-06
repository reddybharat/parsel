import { fetchDashboardOverview } from "@/api/dashboard";
import { queryClient } from "@/lib/queryClient";

export const TREND_MONTHS = 12;
export const RECENT_ACTIVITY_LIMIT = 11;

export const dashboardOverviewQueryKey = [
  "dashboard",
  "overview",
  TREND_MONTHS,
  RECENT_ACTIVITY_LIMIT,
] as const;

export function dashboardOverviewQueryOptions() {
  return {
    queryKey: dashboardOverviewQueryKey,
    queryFn: () => fetchDashboardOverview(TREND_MONTHS, RECENT_ACTIVITY_LIMIT),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  };
}

export function invalidateDashboardOverview() {
  return queryClient.invalidateQueries({ queryKey: ["dashboard"] });
}

export function prefetchDashboardOverview() {
  return queryClient.prefetchQuery(dashboardOverviewQueryOptions());
}
