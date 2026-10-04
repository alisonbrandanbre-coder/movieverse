import type { MovieSummary } from "./movie";
import type { Reaction } from "./preferences";

/** Flags a user can turn on and off for a movie. */
export type InteractionType = "FAVORITE" | "WATCHLIST" | "WATCHED" | "LIKE" | "DISLIKE";

export interface MovieInteractionState {
  movieId: number;
  favorite: boolean;
  watchlist: boolean;
  watched: boolean;
  reaction: Reaction | null;
}

export type SavedListKind = "favorites" | "watchlist" | "watched";

/** Every list under `/me/…`: the profile tabs plus the liked movies (Universo start screen). */
export type MovieListKind = SavedListKind | "likes";

export interface SavedMovie extends MovieSummary {
  addedAt: string;
}

export interface SavedMoviesPage {
  page: number;
  totalPages: number;
  totalResults: number;
  results: SavedMovie[];
}
