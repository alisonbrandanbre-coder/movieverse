import { INTERSTELLAR_SUMMARY_DTO } from "./movieFixtures";

export const GENRES_DTO = [
  { id: 15, name: "Ciencia ficción" },
  { id: 4, name: "Comedia" },
  { id: 7, name: "Drama" },
  { id: 17, name: "Suspense" },
  { id: 11, name: "Terror" },
];

export const OPTIONS_DTO = {
  genres: GENRES_DTO,
  decades: [1970, 1980, 1990, 2000, 2010, 2020],
  languages: [
    { code: "es", name: "Español" },
    { code: "en", name: "Inglés" },
    { code: "ja", name: "Japonés" },
  ],
  discovery_levels: [
    { value: "FAMILIAR", label: "Familiar", description: "Títulos conocidos y apuestas seguras." },
    { value: "BALANCED", label: "Equilibrado", description: "Una mezcla de clásicos y algunas sorpresas." },
    { value: "EXPLORER", label: "Explorador", description: "Joyas menos conocidas, lejos de lo más popular." },
  ],
};

export const PENDING_PREFERENCES_DTO = {
  preferred_genres: [],
  disliked_genres: [],
  preferred_decades: [],
  preferred_languages: [],
  discovery_level: "BALANCED",
  onboarding_completed: false,
  updated_at: "2026-10-04T10:00:00Z",
};

export const DEMO_PREFERENCES_DTO = {
  preferred_genres: [
    { id: 15, name: "Ciencia ficción" },
    { id: 17, name: "Suspense" },
  ],
  disliked_genres: [{ id: 11, name: "Terror" }],
  preferred_decades: [1990, 2000],
  preferred_languages: ["en"],
  discovery_level: "EXPLORER",
  onboarding_completed: true,
  updated_at: "2026-10-04T10:00:00Z",
};

export const SAMPLE_DTO = {
  results: [
    INTERSTELLAR_SUMMARY_DTO,
    { id: 3, tmdb_id: 27205, title: "Inception", release_year: 2010, poster_url: null, vote_average: 8.4 },
  ],
};

export interface InteractionStateDto {
  movie_id: number;
  favorite: boolean;
  watchlist: boolean;
  watched: boolean;
  reaction: "LIKE" | "DISLIKE" | null;
}

export function interactionState(overrides: Partial<InteractionStateDto> = {}): InteractionStateDto {
  return { movie_id: 1, favorite: false, watchlist: false, watched: false, reaction: null, ...overrides };
}

export function savedPage(results: unknown[] = []) {
  return { page: 1, total_pages: results.length ? 1 : 0, total_results: results.length, results };
}
