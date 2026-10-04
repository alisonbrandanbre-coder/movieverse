import { useEffect, useState } from "react";
import { Navigate } from "react-router";

import { Logo } from "@/components/brand/Logo";
import { SpaceBackground } from "@/components/brand/SpaceBackground";
import { TAGLINE } from "@/components/brand/tagline";
import { useAuth } from "@/features/auth/useAuth";

const SEEN_KEY = "mv:intro-seen";
/** Must match the end of `--animate-intro-crawl` / `--animate-intro-out` in index.css. */
const INTRO_MS = 3000;

function shouldPlay(): boolean {
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
    return window.sessionStorage.getItem(SEEN_KEY) === null;
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    window.sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Storage unavailable: the intro just plays again next time.
  }
}

/**
 * Initial route. Plays a 3 s sci-fi style opening once per browser session
 * (skipped with `prefers-reduced-motion`), then sends the user to Discover
 * if there is a session or to Login otherwise.
 */
export function IntroPage() {
  const { status } = useAuth();
  const [playing] = useState(shouldPlay);
  const [finished, setFinished] = useState(!playing);

  useEffect(() => {
    if (!playing) return;
    markSeen();
    const timer = window.setTimeout(() => setFinished(true), INTRO_MS);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setFinished(true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [playing]);

  if (finished && status !== "loading") {
    return <Navigate to={status === "authenticated" ? "/discover" : "/login"} replace />;
  }
  if (!playing) return <SpaceBackground planet="hero" />;

  return (
    <div className="relative isolate h-screen overflow-hidden">
      <SpaceBackground planet="hero" />
      <section aria-label="Introducción de MovieVerse" className="absolute inset-0 animate-intro-out">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-intro-logo">
            <Logo size="lg" />
          </div>
        </div>

        <div className="absolute inset-0 flex justify-center [perspective:380px]">
          <div className="absolute bottom-0 max-w-3xl origin-[50%_100%] animate-intro-crawl px-6 text-center font-crawl font-semibold uppercase text-crawl">
            <p className="text-lg tracking-[6px] sm:text-2xl">Episodio I</p>
            <p className="mb-6 mt-2 text-4xl leading-tight tracking-[3px] sm:text-6xl">El universo de las películas</p>
            <p className="text-2xl normal-case leading-snug tracking-wide sm:text-4xl">
              {TAGLINE.lead} {TAGLINE.accent}
            </p>
          </div>
        </div>
      </section>

      <button
        type="button"
        autoFocus
        onClick={() => setFinished(true)}
        className="absolute bottom-6 right-6 z-10 rounded-control border border-line-strong bg-surface px-4 py-2 text-sm font-semibold text-fg-secondary backdrop-blur-md hover:border-focus hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
      >
        Saltar intro <span aria-hidden>›</span>
      </button>
    </div>
  );
}
