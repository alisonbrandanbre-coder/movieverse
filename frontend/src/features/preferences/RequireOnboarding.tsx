import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router";

import { LoadingState } from "@/components/ui/LoadingState";

import { usePreferences } from "./hooks";

/**
 * Sends users who have not finished the onboarding to `/onboarding`.
 * If preferences cannot be loaded, the page is shown anyway instead of trapping the user.
 * As a route element it guards its child routes; with `children`, just those.
 */
export function RequireOnboarding({ children }: { children?: ReactNode }) {
  const preferences = usePreferences();

  if (preferences.isPending) return <LoadingState label="Cargando tu universo…" />;
  if (preferences.isSuccess && !preferences.data.onboardingCompleted) return <Navigate to="/onboarding" replace />;
  return children ?? <Outlet />;
}
