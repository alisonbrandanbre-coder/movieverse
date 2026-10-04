import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getMood, getMovie, getMovieCredits, getTrending, movieKeys, SEARCH_MIN_LENGTH, searchMovies } from "./api";

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

export function useTrending() {
  return useQuery({
    queryKey: movieKeys.trending,
    queryFn: ({ signal }) => getTrending(signal),
    staleTime: 30 * 60_000,
  });
}

export function useMood(slug: string, page = 1) {
  return useQuery({
    queryKey: movieKeys.mood(slug, page),
    queryFn: ({ signal }) => getMood(slug, page, signal),
    placeholderData: keepPreviousData,
    staleTime: 30 * 60_000,
  });
}
