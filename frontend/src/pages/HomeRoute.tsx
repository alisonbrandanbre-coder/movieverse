import { useCallback, useState } from "react";
import { Navigate } from "react-router";

import { useAuth } from "@/features/auth/useAuth";
import { shouldPlayIntro } from "@/features/intro/session";
import { RequireOnboarding } from "@/features/preferences/RequireOnboarding";

import { HomePage } from "./HomePage";
import { IntroPage } from "./IntroPage";

/**
 * Entry route `/`: the opening once per session (over the page, so the Home already loads
 * behind it), then the Home with a session (onboarding first if pending) or the login
 * without one.
 */
export function HomeRoute() {
  const { status } = useAuth();
  const [intro, setIntro] = useState(shouldPlayIntro);
  const finishIntro = useCallback(() => setIntro(false), []);

  return (
    <>
      {intro && <IntroPage onDone={finishIntro} />}
      {status === "authenticated" && (
        // Like Descubrir: a new account goes through the onboarding first.
        <RequireOnboarding>
          <HomePage />
        </RequireOnboarding>
      )}
      {status === "anonymous" && !intro && <Navigate to="/login" replace />}
    </>
  );
}
