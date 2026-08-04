import { Navigate, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { banksQueryOptions } from "@/lib/banksQuery";

/**
 * Gates the app behind bank setup: a user with no profile banks is sent to the
 * setup screen before they can add transactions or read a (meaningless) dashboard.
 */
export function RequireProfileBanks() {
  const { data: banks, isPending, isError } = useQuery(banksQueryOptions());

  if (isPending) {
    return (
      <div className="flex h-screen w-full items-center justify-center text-sm text-parsel-muted">
        Loading…
      </div>
    );
  }

  // On a load failure, let the app render so its own error states can surface
  // rather than trapping the user on a blank gate.
  if (!isError && (banks?.length ?? 0) === 0) {
    return <Navigate to="/setup/banks" replace />;
  }

  return <Outlet />;
}
