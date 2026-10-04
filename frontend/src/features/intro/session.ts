/** The opening plays once per browser session, never with reduced motion. */
const SEEN_KEY = "mv:intro-seen";

export function shouldPlayIntro(): boolean {
  try {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
    return window.sessionStorage.getItem(SEEN_KEY) === null;
  } catch {
    return false;
  }
}

export function markIntroSeen(): void {
  try {
    window.sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Storage unavailable: the intro just plays again next time.
  }
}
