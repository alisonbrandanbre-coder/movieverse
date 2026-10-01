import { Navigate, Outlet, useLocation } from "react-router";

import { LoadingState } from "@/components/ui/LoadingState";

import { useAuth } from "./useAuth";

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") return <LoadingState label="Verificando sesión…" />;
  if (status === "anonymous") {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

/** Redirects authenticated users away from login/register. */
export function GuestRoute() {
  const { status } = useAuth();
  if (status === "loading") return <LoadingState label="Verificando sesión…" />;
  if (status === "authenticated") return <Navigate to="/discover" replace />;
  return <Outlet />;
}
