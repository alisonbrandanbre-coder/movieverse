import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";

import { AppLayout } from "@/components/layout/AppLayout";
import { GuestRoute, ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { RequireOnboarding } from "@/features/preferences/RequireOnboarding";
import { DiscoverPage } from "@/pages/DiscoverPage";
import { HomeRoute } from "@/pages/HomeRoute";
import { LoginPage } from "@/pages/LoginPage";
import { MoodPage } from "@/pages/MoodPage";
import { MovieDetailPage } from "@/pages/MovieDetailPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { OnboardingPage } from "@/pages/OnboardingPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { RegisterPage } from "@/pages/RegisterPage";
import { SearchPage } from "@/pages/SearchPage";
import { UniverseStartPage } from "@/pages/UniverseStartPage";
import { StarsLoadingState } from "@/components/ui/StarsLoadingState";

// The cinematic map brings React Flow: loaded only when the user opens it.
const UniversePage = lazy(() => import("@/pages/UniversePage").then((m) => ({ default: m.UniversePage })));

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* `/`: the opening once per session, then the Home (or the login without a session). */}
        <Route index element={<HomeRoute />} />
        <Route element={<GuestRoute />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="onboarding" element={<OnboardingPage />} />
          <Route element={<RequireOnboarding />}>
            <Route path="discover" element={<DiscoverPage />} />
          </Route>
          <Route path="search" element={<SearchPage />} />
          <Route path="mood/:slug" element={<MoodPage />} />
          <Route path="movies/:id" element={<MovieDetailPage />} />
          <Route path="universe" element={<UniverseStartPage />} />
          <Route
            path="universe/:movieId"
            element={
              <Suspense fallback={<StarsLoadingState label="Trazando el universo…" />}>
                <UniversePage />
              </Suspense>
            }
          />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
