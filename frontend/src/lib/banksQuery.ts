import { fetchBanks } from "@/api/tracker";
import { queryClient } from "@/lib/queryClient";
import { setTrackerConfigBanks } from "@/lib/trackerConfigQuery";
import type { ProfileBank } from "@/lib/types";

export const banksQueryKey = ["banks"] as const;

export function banksQueryOptions() {
  return {
    queryKey: banksQueryKey,
    queryFn: (): Promise<ProfileBank[]> => fetchBanks(),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  };
}

export function invalidateBanks() {
  return queryClient.invalidateQueries({ queryKey: banksQueryKey });
}

/**
 * Write the profile banks into the cache and keep the derived active-bank list
 * on the tracker config (entry dropdowns) in sync in one place.
 */
export function setProfileBanks(banks: ProfileBank[]) {
  queryClient.setQueryData<ProfileBank[]>(banksQueryKey, banks);
  setTrackerConfigBanks(banks.filter((b) => b.is_active).map((b) => b.bank));
}
