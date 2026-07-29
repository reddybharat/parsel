import { keepPreviousData } from "@tanstack/react-query";

import { searchTransactions, type SearchParams } from "@/api/tracker";
import { queryClient } from "@/lib/queryClient";
import type { SearchResult } from "@/lib/types";

export const transactionSearchQueryKeyRoot = ["transactions", "search"] as const;

export function transactionSearchQueryOptions(params: SearchParams, enabled: boolean) {
  return {
    queryKey: [...transactionSearchQueryKeyRoot, params] as const,
    queryFn: (): Promise<SearchResult> => searchTransactions(params),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  };
}

export function invalidateTransactionSearch() {
  return queryClient.invalidateQueries({ queryKey: transactionSearchQueryKeyRoot });
}
