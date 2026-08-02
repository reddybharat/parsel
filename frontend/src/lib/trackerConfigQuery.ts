import { fetchTrackerConfig } from "@/api/tracker";
import { normalizeCategories } from "@/lib/categories";
import { queryClient } from "@/lib/queryClient";
import type { Category, TrackerConfig } from "@/lib/types";

export type CachedTrackerConfig = {
  categories: Category[];
  payment_methods: string[];
  banks: string[];
};

export const trackerConfigQueryKey = ["tracker", "config"] as const;

export function trackerConfigQueryOptions() {
  return {
    queryKey: trackerConfigQueryKey,
    queryFn: async (): Promise<CachedTrackerConfig> => {
      const config = await fetchTrackerConfig();
      return {
        categories: normalizeCategories(config.categories),
        payment_methods: config.payment_methods,
        banks: config.banks ?? [],
      };
    },
    // Config rarely changes; refresh only on explicit invalidation (create/rename/import).
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  };
}

export function prefetchTrackerConfig() {
  return queryClient.prefetchQuery(trackerConfigQueryOptions());
}

export function invalidateTrackerConfig() {
  return queryClient.invalidateQueries({ queryKey: trackerConfigQueryKey });
}

export function setTrackerConfigCategories(categories: Category[]) {
  queryClient.setQueryData<CachedTrackerConfig>(trackerConfigQueryKey, (current) => {
    if (!current) {
      return { categories, payment_methods: [], banks: [] };
    }
    return { ...current, categories };
  });
}

export function applyTrackerConfig(config: TrackerConfig) {
  const next: CachedTrackerConfig = {
    categories: normalizeCategories(config.categories),
    payment_methods: config.payment_methods,
    banks: config.banks ?? [],
  };
  queryClient.setQueryData(trackerConfigQueryKey, next);
  return next;
}
