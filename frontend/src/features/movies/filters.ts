/**
 * Buscar / Descubrir filters. They live in the URL (`?genres=1,5&decade=1990&rating=7&runtime=90`)
 * so a filtered list can be shared and survives "back"; the backend validates and applies them.
 */

export const MIN_RATINGS = [6, 7, 8] as const;
export const RUNTIMES = [
  { value: 90, label: "Menos de 90 min" },
  { value: 120, label: "Menos de 2 h" },
] as const;

export type MinRating = (typeof MIN_RATINGS)[number];
export type MaxRuntime = (typeof RUNTIMES)[number]["value"];

export interface MovieFilters {
  /** Local genre ids (from `/preferences/options`); a movie must have all of them. */
  genres: number[];
  /** Start year of the decade (1990 = the 90s). */
  decade: number | null;
  rating: MinRating | null;
  /** The runtime must be lower than this many minutes. */
  runtime: MaxRuntime | null;
}

export const NO_FILTERS: MovieFilters = { genres: [], decade: null, rating: null, runtime: null };

const FILTER_KEYS = ["genres", "decade", "rating", "runtime"] as const;

function readInt(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  return Number(value);
}

function oneOf<T extends number>(value: number | null, options: readonly T[]): T | null {
  return value !== null && (options as readonly number[]).includes(value) ? (value as T) : null;
}

/** Filters from the URL; unknown or malformed values are ignored. */
export function readFilters(params: URLSearchParams): MovieFilters {
  const genres = (params.get("genres") ?? "")
    .split(",")
    .map((part) => readInt(part.trim()))
    .filter((id): id is number => id !== null && id > 0);
  const decade = readInt(params.get("decade"));
  return {
    genres: [...new Set(genres)],
    decade: decade !== null && decade % 10 === 0 && decade >= 1900 ? decade : null,
    rating: oneOf(readInt(params.get("rating")), MIN_RATINGS),
    runtime: oneOf(
      readInt(params.get("runtime")),
      RUNTIMES.map((r) => r.value),
    ),
  };
}

/** Writes the filters into a copy of `params` (keeping `q` and anything else), dropping the empty ones. */
export function writeFilters(params: URLSearchParams, filters: MovieFilters): URLSearchParams {
  const next = new URLSearchParams(params);
  FILTER_KEYS.forEach((key) => next.delete(key));
  const values = toQuery(filters);
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined) next.set(key, String(value));
  });
  return next;
}

/** Query params for the API (only the active filters). */
export function toQuery(filters: MovieFilters): Record<string, string | number | undefined> {
  return {
    genres: filters.genres.length ? filters.genres.join(",") : undefined,
    decade: filters.decade ?? undefined,
    rating: filters.rating ?? undefined,
    runtime: filters.runtime ?? undefined,
  };
}

export function hasFilters(filters: MovieFilters): boolean {
  return activeFilterCount(filters) > 0;
}

/** How many filters are set (each genre counts as one). */
export function activeFilterCount(filters: MovieFilters): number {
  return filters.genres.length + [filters.decade, filters.rating, filters.runtime].filter((v) => v !== null).length;
}

/** Stable text form, for query keys. */
export function filtersKey(filters: MovieFilters): string {
  return new URLSearchParams(
    Object.entries(toQuery({ ...filters, genres: [...filters.genres].sort((a, b) => a - b) })).filter(
      (entry): entry is [string, string | number] => entry[1] !== undefined,
    ).map(([key, value]) => [key, String(value)]),
  ).toString();
}
