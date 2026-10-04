/** Movies API: DTOs as returned by the backend (snake_case) and mappers to UI types. */
import { apiRequest } from "@/api/client";
import type {
  CastMember,
  Director,
  MovieCard,
  MovieCredits,
  MovieDetail,
  MovieList,
  MoodResults,
  MovieSearchPage,
  MovieSummary,
  MovieWatchProviders,
  WatchProvider,
} from "@/types/movie";

import { changesResults, filtersKey, NO_FILTERS, toQuery, type MovieFilters } from "./filters";

export interface MovieSummaryDto {
  id: number;
  tmdb_id: number;
  title: string;
  release_year: number | null;
  poster_url: string | null;
  vote_average: number | null;
}

interface MovieDetailDto extends MovieSummaryDto {
  original_title: string;
  overview: string;
  release_date: string | null;
  runtime: number | null;
  original_language: string;
  backdrop_url: string | null;
  popularity: number;
  vote_count: number;
  genres: { id: number; name: string }[];
}

interface MovieSearchDto {
  query: string;
  page: number;
  total_pages: number;
  total_results: number;
  results: MovieSummaryDto[];
}

interface DirectorDto {
  id: number;
  tmdb_id: number;
  name: string;
  profile_url: string | null;
}

interface CastMemberDto extends DirectorDto {
  character: string;
  order: number | null;
}

interface MovieCreditsDto {
  directors: DirectorDto[];
  cast: CastMemberDto[];
}

interface WatchProviderDto {
  tmdb_id: number;
  name: string;
  logo_url: string | null;
}

interface WatchProvidersDto {
  region: string;
  results: WatchProviderDto[];
}

interface MovieWatchProvidersDto {
  region: string;
  link: string | null;
  streaming: WatchProviderDto[];
  rent: WatchProviderDto[];
  buy: WatchProviderDto[];
}

export const SEARCH_MIN_LENGTH = 2;

interface MovieCardDto extends MovieSummaryDto {
  backdrop_url: string | null;
  overview: string;
}

interface MovieListDto {
  results: MovieCardDto[];
  degraded: boolean;
}

interface MoodResultsDto extends MovieListDto {
  mood: { slug: string; label: string; description: string };
  page: number;
  has_more: boolean;
}

export const movieKeys = {
  all: ["movies"] as const,
  trending: ["movies", "trending"] as const,
  mood: (slug: string, page: number) => ["movies", "mood", slug, page] as const,
  // Without filters (nor another order) the key is the autocomplete's too (shared cache).
  search: (query: string, page: number, filters: MovieFilters = NO_FILTERS) =>
    changesResults(filters)
      ? (["movies", "search", query, page, filtersKey(filters)] as const)
      : (["movies", "search", query, page] as const),
  discover: (filters: MovieFilters, page: number) => ["movies", "discover", filtersKey(filters), page] as const,
  detail: (id: number) => ["movies", "detail", id] as const,
  credits: (id: number) => ["movies", "credits", id] as const,
  providers: ["movies", "providers"] as const,
  watchProviders: (id: number) => ["movies", "watch-providers", id] as const,
};

export function toSummary(dto: MovieSummaryDto): MovieSummary {
  return {
    id: dto.id,
    tmdbId: dto.tmdb_id,
    title: dto.title,
    releaseYear: dto.release_year,
    posterUrl: dto.poster_url,
    voteAverage: dto.vote_average,
  };
}

function toDetail(dto: MovieDetailDto): MovieDetail {
  return {
    ...toSummary(dto),
    originalTitle: dto.original_title,
    overview: dto.overview,
    releaseDate: dto.release_date,
    runtime: dto.runtime,
    originalLanguage: dto.original_language,
    backdropUrl: dto.backdrop_url,
    popularity: dto.popularity,
    voteCount: dto.vote_count,
    genres: dto.genres,
  };
}

function toDirector(dto: DirectorDto): Director {
  return { id: dto.id, tmdbId: dto.tmdb_id, name: dto.name, profileUrl: dto.profile_url };
}

function toCastMember(dto: CastMemberDto): CastMember {
  return { ...toDirector(dto), character: dto.character, order: dto.order };
}

function toSearchPage(dto: MovieSearchDto): MovieSearchPage {
  return {
    query: dto.query,
    page: dto.page,
    totalPages: dto.total_pages,
    totalResults: dto.total_results,
    results: dto.results.map(toSummary),
  };
}

/** Search by title; with filters, the backend filters TMDB's results. */
export async function searchMovies(
  query: string,
  page = 1,
  signal?: AbortSignal,
  filters: MovieFilters = NO_FILTERS,
): Promise<MovieSearchPage> {
  return toSearchPage(
    await apiRequest<MovieSearchDto>("/movies/search", { params: { q: query, page, ...toQuery(filters) }, signal }),
  );
}

/** Catalog by filters without a text (TMDB discover). */
export async function discoverMovies(filters: MovieFilters, page = 1, signal?: AbortSignal): Promise<MovieSearchPage> {
  return toSearchPage(await apiRequest<MovieSearchDto>("/movies/discover", { params: { page, ...toQuery(filters) }, signal }));
}

export async function getMovie(id: number, signal?: AbortSignal): Promise<MovieDetail> {
  return toDetail(await apiRequest<MovieDetailDto>(`/movies/${id}`, { signal }));
}

export async function getMovieCredits(id: number, signal?: AbortSignal): Promise<MovieCredits> {
  const dto = await apiRequest<MovieCreditsDto>(`/movies/${id}/credits`, { signal });
  return { directors: dto.directors.map(toDirector), cast: dto.cast.map(toCastMember) };
}

function toCard(dto: MovieCardDto): MovieCard {
  return { ...toSummary(dto), backdropUrl: dto.backdrop_url, overview: dto.overview };
}

/** Trending movies of the week (TMDB, cached by the backend). */
export async function getTrending(signal?: AbortSignal): Promise<MovieList> {
  const dto = await apiRequest<MovieListDto>("/movies/trending", { signal });
  return { movies: dto.results.map(toCard), degraded: dto.degraded };
}

/** Movies for a mood of the Home; the backend maps the mood to TMDB filters. */
export async function getMood(slug: string, page = 1, signal?: AbortSignal): Promise<MoodResults> {
  const dto = await apiRequest<MoodResultsDto>(`/movies/mood/${encodeURIComponent(slug)}`, { params: { page }, signal });
  return { mood: dto.mood, page: dto.page, hasMore: dto.has_more, movies: dto.results.map(toCard), degraded: dto.degraded };
}

function toWatchProvider(dto: WatchProviderDto): WatchProvider {
  return { tmdbId: dto.tmdb_id, name: dto.name, logoUrl: dto.logo_url };
}

/** Streaming platforms of the region, for the "Dónde verla" filter. */
export async function getWatchProviders(signal?: AbortSignal): Promise<WatchProvider[]> {
  const dto = await apiRequest<WatchProvidersDto>("/movies/providers", { signal });
  return dto.results.map(toWatchProvider);
}

/** Where a movie can be watched in the region (streaming, rent, buy). */
export async function getMovieWatchProviders(id: number, signal?: AbortSignal): Promise<MovieWatchProviders> {
  const dto = await apiRequest<MovieWatchProvidersDto>(`/movies/${id}/providers`, { signal });
  return {
    region: dto.region,
    link: dto.link,
    streaming: dto.streaming.map(toWatchProvider),
    rent: dto.rent.map(toWatchProvider),
    buy: dto.buy.map(toWatchProvider),
  };
}
