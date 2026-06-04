import { getJson } from "./client";
import type { DashboardOverview } from "../lib/types";

export function fetchDashboardOverview(months = 12, recentLimit = 4) {
  return getJson<DashboardOverview>("/dashboard/overview", {
    months,
    recent_limit: recentLimit,
  });
}
