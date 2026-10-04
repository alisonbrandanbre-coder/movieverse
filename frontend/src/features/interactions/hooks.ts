import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { InteractionType, MovieInteractionState, SavedListKind } from "@/types/interactions";

import { getMovieInteractions, getSavedMovies, interactionKeys, setInteraction } from "./api";

export function useMovieInteractions(movieId: number) {
  return useQuery({
    queryKey: interactionKeys.movie(movieId),
    queryFn: ({ signal }) => getMovieInteractions(movieId, signal),
    enabled: Number.isInteger(movieId) && movieId > 0,
  });
}

export function useSavedMovies(kind: SavedListKind, page: number) {
  return useQuery({
    queryKey: interactionKeys.list(kind, page),
    queryFn: ({ signal }) => getSavedMovies(kind, page, signal),
    placeholderData: keepPreviousData,
  });
}

/** Flip only the touched flag; the server answer then applies the side effects (e.g. LIKE ↔ DISLIKE). */
function optimistic(state: MovieInteractionState, type: InteractionType, active: boolean): MovieInteractionState {
  switch (type) {
    case "FAVORITE":
      return { ...state, favorite: active };
    case "WATCHLIST":
      return { ...state, watchlist: active };
    case "WATCHED":
      return { ...state, watched: active };
    case "LIKE":
    case "DISLIKE":
      return { ...state, reaction: active ? type : null };
  }
}

interface ToggleVariables {
  type: InteractionType;
  active: boolean;
}

/**
 * Turn a flag on/off for a movie with an optimistic update (rolled back on error).
 * Profile lists are refetched afterwards.
 */
export function useToggleInteraction(movieId: number) {
  const queryClient = useQueryClient();
  const key = interactionKeys.movie(movieId);

  return useMutation({
    mutationFn: ({ type, active }: ToggleVariables) => setInteraction(movieId, type, active),
    onMutate: async ({ type, active }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MovieInteractionState>(key);
      if (previous) queryClient.setQueryData(key, optimistic(previous, type, active));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (state) => queryClient.setQueryData(key, state),
    onSettled: () => queryClient.invalidateQueries({ queryKey: interactionKeys.lists }),
  });
}
