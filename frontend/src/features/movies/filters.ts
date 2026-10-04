/**
 * Buscar / Descubrir filters. They live in the URL
 * (`?genres=1,5&providers=8,337&runtime=long&countries=AR,OTHER&popularity=hidden&sort=rating&hide_watched=1`)
 * so a filtered list can be shared and survives "back"; the backend validates and applies them.
 */

export const MIN_RATINGS = [6, 7, 8] as const;
/** A minimum rating only counts titles with at least this many votes (applied by the backend). */
export const RATED_MIN_VOTES = 100;

export const RUNTIMES = [
  { value: "short", label: "Cortas", hint: "menos de 90 min" },
  { value: "normal", label: "Normales", hint: "90–120 min" },
  { value: "long", label: "Largas", hint: "120–150 min" },
  { value: "epic", label: "Épicas", hint: "más de 150 min" },
] as const;

export const COUNTRIES = [
  { code: "AR", name: "Argentina" },
  { code: "US", name: "Estados Unidos" },
  { code: "GB", name: "Reino Unido" },
  { code: "FR", name: "Francia" },
  { code: "ES", name: "España" },
  { code: "IT", name: "Italia" },
  { code: "KR", name: "Corea del Sur" },
  { code: "JP", name: "Japón" },
  { code: "MX", name: "México" },
  { code: "OTHER", name: "Otros" },
] as const;

/** The recommender's popularity buckets (by number of votes). */
export const POPULARITIES = [
  { value: "hidden", label: "Joyas ocultas" },
  { value: "balanced", label: "Equilibrado" },
  { value: "blockbuster", label: "Taquilleras" },
] as const;

export const SORTS = [
  { value: "relevance", label: "Relevancia" },
  { value: "rating", label: "Mejor puntaje" },
  { value: "newest", label: "Más recientes" },
  { value: "oldest", label: "Más antiguas" },
  { value: "popular", label: "Más populares" },
] as const;

export type MinRating = (typeof MIN_RATINGS)[number];
export type RuntimeRange = (typeof RUNTIMES)[number]["value"];
export type CountryCode = (typeof COUNTRIES)[number]["code"];
export type Popularity = (typeof POPULARITIES)[number]["value"];
export type SortOrder = (typeof SORTS)[number]["value"];

export interface MovieFilters {
  /** Local genre ids (from `/preferences/options`); a movie must have all of them. */
  genres: number[];
  /** TMDB ids of streaming platforms (from `/movies/providers`); any of them. */
  providers: number[];
  /** Start year of the decade (1990 = the 90s). */
  decade: number | null;
  rating: MinRating | null;
  runtime: RuntimeRange | null;
  /** Countries of origin; any of them. */
  countries: CountryCode[];
  popularity: Popularity | null;
  sort: SortOrder;
  hideWatched: boolean;
}

export const NO_FILTERS: MovieFilters = {
  genres: [],
  providers: [],
  decade: null,
  rating: null,
  runtime: null,
  countries: [],
  popularity: null,
  sort: "relevance",
  hideWatched: false,
};

const FILTER_KEYS = ["genres", "providers", "decade", "rating", "runtime", "countries", "popularity", "sort", "hide_watched"] as const;

function readInt(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  return Number(value);
}

function readIds(value: string | null): number[] {
  const ids = (value ?? "")
    .split(",")
    .map((part) => readInt(part.trim()))
    .filter((id): id is number => id !== null && id > 0);
  return [...new Set(ids)];
}

function oneOf<T extends string | number>(value: string | number | null, options: readonly T[]): T | null {
  return value !== null && (options as readonly (string | number)[]).includes(value) ? (value as T) : null;
}

const COUNTRY_CODES = COUNTRIES.map((c) => c.code);

/** Filters from the URL; unknown or malformed values are ignored. */
export function readFilters(params: URLSearchParams): MovieFilters {
  const decade = readInt(params.get("decade"));
  const countries = (params.get("countries") ?? "")
    .split(",")
    .map((part) => oneOf(part.trim().toUpperCase(), COUNTRY_CODES))
    .filter((code): code is CountryCode => code !== null);
  return {
    genres: readIds(params.get("genres")),
    providers: readIds(params.get("providers")),
    decade: decade !== null && decade % 10 === 0 && decade >= 1900 ? decade : null,
    rating: oneOf(readInt(params.get("rating")), MIN_RATINGS),
    runtime: oneOf(
      params.get("runtime"),
      RUNTIMES.map((r) => r.value),
    ),
    countries: [...new Set(countries)],
    popularity: oneOf(
      params.get("popularity"),
      POPULARITIES.map((p) => p.value),
    ),
    sort:
      oneOf(
        params.get("sort"),
        SORTS.map((s) => s.value),
      ) ?? "relevance",
    hideWatched: params.get("hide_watched") === "1",
  };
}

/** Writes the filters into a copy of `params` (keeping `q` and anything else), dropping the empty ones. */
export function writeFilters(params: URLSearchParams, filters: MovieFilters): URLSearchParams {
  const next = new URLSearchParams(params);
  FILTER_KEYS.forEach((key) => next.delete(key));
  Object.entries(toQuery(filters)).forEach(([key, value]) => {
    if (value !== undefined) next.set(key, String(value));
  });
  return next;
}

/** Query params for the API and the URL (only the active filters; relevance is the default order). */
export function toQuery(filters: MovieFilters): Record<string, string | number | undefined> {
  return {
    genres: filters.genres.length ? filters.genres.join(",") : undefined,
    providers: filters.providers.length ? filters.providers.join(",") : undefined,
    decade: filters.decade ?? undefined,
    rating: filters.rating ?? undefined,
    runtime: filters.runtime ?? undefined,
    countries: filters.countries.length ? filters.countries.join(",") : undefined,
    popularity: filters.popularity ?? undefined,
    sort: filters.sort === "relevance" ? undefined : filters.sort,
    hide_watched: filters.hideWatched ? 1 : undefined,
  };
}

/** Some filter is set (the order alone is not a filter). */
export function hasFilters(filters: MovieFilters): boolean {
  return activeFilterCount(filters) > 0;
}

/** The results differ from the default ones: some filter, or another order. */
export function changesResults(filters: MovieFilters): boolean {
  return hasFilters(filters) || filters.sort !== "relevance";
}

/** How many filters are set (each genre, platform and country counts as one). */
export function activeFilterCount(filters: MovieFilters): number {
  return (
    filters.genres.length +
    filters.providers.length +
    filters.countries.length +
    [filters.decade, filters.rating, filters.runtime, filters.popularity].filter((v) => v !== null).length +
    (filters.hideWatched ? 1 : 0)
  );
}

/** Stable text form, for query keys. */
export function filtersKey(filters: MovieFilters): string {
  const sorted = {
    ...filters,
    genres: [...filters.genres].sort((a, b) => a - b),
    providers: [...filters.providers].sort((a, b) => a - b),
    countries: [...filters.countries].sort(),
  };
  return new URLSearchParams(
    Object.entries(toQuery(sorted))
      .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
      .map(([key, value]) => [key, String(value)]),
  ).toString();
}

/** Adds the value if missing, removes it if present. */
export function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}
