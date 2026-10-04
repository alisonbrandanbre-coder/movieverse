import { useEffect } from "react";

import { Logo } from "@/components/brand/Logo";
import { SpaceBackground } from "@/components/brand/SpaceBackground";
import { TAGLINE } from "@/components/brand/tagline";
import { markIntroSeen } from "@/features/intro/session";

/** Must match the end of `--animate-intro-crawl` / `--animate-intro-out` in index.css. */
const INTRO_MS = 3000;

/**
 * 3 s sci-fi style opening, over the whole screen. Shown by the entry route (`HomeRoute`)
 * once per browser session; ends on its own, with "Saltar intro" or Escape.
 */
export function IntroPage({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    markIntroSeen();
    const timer = window.setTimeout(onDone, INTRO_MS);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onDone();
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 isolate overflow-hidden">
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
        onClick={onDone}
        className="absolute bottom-6 right-6 z-10 rounded-control border border-line-strong bg-surface px-4 py-2 text-sm font-semibold text-fg-secondary backdrop-blur-md hover:border-focus hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
      >
        Saltar intro <span aria-hidden>›</span>
      </button>
    </div>
  );
}
