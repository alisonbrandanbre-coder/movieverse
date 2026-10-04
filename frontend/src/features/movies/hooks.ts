import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  discoverMovies,
  getMood,
  getMovie,
  getMovieCredits,
  getTrending,
  movieKeys,
  SEARCH_MIN_LENGTH,
  searchMovies,
} from "./api";
import { NO_FILTERS, type MovieFilters } from "./filters";

export function useMovieSearch(query: string, page = 1, filters: MovieFilters = NO_FILTERS) {
  const normalized = query.trim();
  return useQuery({
    queryKey: movieKeys.search(normalized, page, filters),
    queryFn: ({ signal }) => searchMovies(normalized, page, signal, filters),
    enabled: normalized.length >= SEARCH_MIN_LENGTH,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}

/** Movies matching the filters, without a text (TMDB discover). */
export function useMovieDiscover(filters: MovieFilters, page = 1, enabled = true) {
  return useQuery({
    queryKey: movieKeys.discover(filters, page),
    queryFn: ({ signal }) => discoverMovies(filters, page, signal),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 10 * 60_000,
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
