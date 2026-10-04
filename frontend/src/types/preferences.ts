import type { Genre } from "./movie";

export type DiscoveryLevel = "FAMILIAR" | "BALANCED" | "EXPLORER";
export type Reaction = "LIKE" | "DISLIKE";

export interface Preferences {
  preferredGenres: Genre[];
  dislikedGenres: Genre[];
  /** Decade start years: 1990 = the 90s. */
  preferredDecades: number[];
  /** ISO 639-1 codes. */
  preferredLanguages: string[];
  discoveryLevel: DiscoveryLevel;
  onboardingCompleted: boolean;
}

/** What the forms edit and send: genres as ids. */
export interface PreferencesDraft {
  preferredGenreIds: number[];
  dislikedGenreIds: number[];
  decades: number[];
  languages: string[];
  discoveryLevel: DiscoveryLevel;
}

export interface QuickRating {
  movieId: number;
  reaction: Reaction;
}

export interface PreferenceOptions {
  genres: Genre[];
  decades: number[];
  languages: { code: string; name: string }[];
  discoveryLevels: { value: DiscoveryLevel; label: string; description: string }[];
}
