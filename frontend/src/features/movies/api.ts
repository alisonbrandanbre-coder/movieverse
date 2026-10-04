/** Movies API: DTOs as returned by the backend (snake_case) and mappers to UI types. */
import { apiRequest } from "@/api/client";
import type {
  CastMember,
  Director,
  MovieCredits,
  MovieDetail,
  MovieSearchPage,
  MovieSummary,
} from "@/types/movie";

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

export const SEARCH_MIN_LENGTH = 2;

export const movieKeys = {
  all: ["movies"] as const,
  search: (query: string, page: number) => ["movies", "search", query, page] as const,
  detail: (id: number) => ["movies", "detail", id] as const,
  credits: (id: number) => ["movies", "credits", id] as const,
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

export async function searchMovies(query: string, page = 1, signal?: AbortSignal): Promise<MovieSearchPage> {
  const dto = await apiRequest<MovieSearchDto>("/movies/search", { params: { q: query, page }, signal });
  return {
    query: dto.query,
    page: dto.page,
    totalPages: dto.total_pages,
    totalResults: dto.total_results,
    results: dto.results.map(toSummary),
  };
}

export async function getMovie(id: number, signal?: AbortSignal): Promise<MovieDetail> {
  return toDetail(await apiRequest<MovieDetailDto>(`/movies/${id}`, { signal }));
}

export async function getMovieCredits(id: number, signal?: AbortSignal): Promise<MovieCredits> {
  const dto = await apiRequest<MovieCreditsDto>(`/movies/${id}/credits`, { signal });
  return { directors: dto.directors.map(toDirector), cast: dto.cast.map(toCastMember) };
}
