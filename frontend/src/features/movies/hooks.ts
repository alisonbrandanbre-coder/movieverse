import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getMovie, getMovieCredits, movieKeys, SEARCH_MIN_LENGTH, searchMovies } from "./api";

export function useMovieSearch(query: string, page = 1) {
  const normalized = query.trim();
  return useQuery({
    queryKey: movieKeys.search(normalized, page),
    queryFn: ({ signal }) => searchMovies(normalized, page, signal),
    enabled: normalized.length >= SEARCH_MIN_LENGTH,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}

export function useMovie(id: number) {
  return useQuery({
    queryKey: movieKeys.detail(id),
    queryFn: ({ signal }) => getMovie(id, signal),
    enabled: Number.isInteger(id) && id > 0,
    staleTime: 10 * 60_000,
  });
}

export function useMovieCredits(id: number) {
  return useQuery({
    queryKey: movieKeys.credits(id),
    queryFn: ({ signal }) => getMovieCredits(id, signal),
    enabled: Number.isInteger(id) && id > 0,
    staleTime: 10 * 60_000,
  });
}
