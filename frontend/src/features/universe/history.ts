/**
 * "Seguí explorando" on the Home: the last movies the user opened as the center of the
 * map, newest first. Kept in this browser only (per user), a convenience like a recent
 * searches list; reading or writing never throws.
 */
import type { MovieSummary } from "@/types/movie";

const KEY_PREFIX = "mv:map-history:";
const MAX_ITEMS = 12;

function key(userId: number | undefined): string | null {
  return userId === undefined ? null : `${KEY_PREFIX}${userId}`;
}

export function readMapHistory(userId: number | undefined): MovieSummary[] {
  const storageKey = key(userId);
  if (!storageKey) return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(value) ? (value as MovieSummary[]).filter((m) => typeof m?.id === "number") : [];
  } catch {
    return [];
  }
}

export function rememberMapVisit(userId: number | undefined, movie: MovieSummary): void {
  const storageKey = key(userId);
  if (!storageKey) return;
  try {
    const history = [movie, ...readMapHistory(userId).filter((m) => m.id !== movie.id)].slice(0, MAX_ITEMS);
    window.localStorage.setItem(storageKey, JSON.stringify(history));
  } catch {
    // Storage unavailable: the Home just won't show "Seguí explorando".
  }
}
