import { Navigate, Outlet } from "react-router";

import { LoadingState } from "@/components/ui/LoadingState";

import { usePreferences } from "./hooks";

/**
 * Sends users who have not finished the onboarding to `/onboarding`.
 * If preferences cannot be loaded, the page is shown anyway instead of trapping the user.
 */
export function RequireOnboarding() {
  const preferences = usePreferences();

  if (preferences.isPending) return <LoadingState label="Cargando tu universo…" />;
  if (preferences.isSuccess && !preferences.data.onboardingCompleted) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
