/** Interactions API. The user is always the session's: no user id is ever sent. */
import { apiRequest } from "@/api/client";
import { toSummary, type MovieSummaryDto } from "@/features/movies/api";
import type {
  InteractionType,
  MovieInteractionState,
  SavedListKind,
  SavedMoviesPage,
} from "@/types/interactions";
import type { Reaction } from "@/types/preferences";

interface MovieInteractionStateDto {
  movie_id: number;
  favorite: boolean;
  watchlist: boolean;
  watched: boolean;
  reaction: Reaction | null;
}

interface SavedMoviesDto {
  page: number;
  total_pages: number;
  total_results: number;
  results: (MovieSummaryDto & { added_at: string })[];
}

export const interactionKeys = {
  movie: (movieId: number) => ["interactions", movieId] as const,
  lists: ["me"] as const,
  list: (kind: SavedListKind, page: number) => ["me", kind, page] as const,
};

function toState(dto: MovieInteractionStateDto): MovieInteractionState {
  return {
    movieId: dto.movie_id,
    favorite: dto.favorite,
    watchlist: dto.watchlist,
    watched: dto.watched,
    reaction: dto.reaction,
  };
}

export async function getMovieInteractions(movieId: number, signal?: AbortSignal): Promise<MovieInteractionState> {
  return toState(await apiRequest<MovieInteractionStateDto>(`/movies/${movieId}/interactions`, { signal }));
}

export async function setInteraction(
  movieId: number,
  type: InteractionType,
  active: boolean,
): Promise<MovieInteractionState> {
  const dto = active
    ? await apiRequest<MovieInteractionStateDto>(`/movies/${movieId}/interactions`, { method: "POST", body: { type } })
    : await apiRequest<MovieInteractionStateDto>(`/movies/${movieId}/interactions/${type}`, { method: "DELETE" });
  return toState(dto);
}

export async function getSavedMovies(kind: SavedListKind, page: number, signal?: AbortSignal): Promise<SavedMoviesPage> {
  const dto = await apiRequest<SavedMoviesDto>(`/me/${kind}`, { params: { page }, signal });
  return {
    page: dto.page,
    totalPages: dto.total_pages,
    totalResults: dto.total_results,
    results: dto.results.map((movie) => ({ ...toSummary(movie), addedAt: movie.added_at })),
  };
}
