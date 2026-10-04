export interface Genre {
  id: number;
  name: string;
}

export interface MovieSummary {
  id: number;
  tmdbId: number;
  title: string;
  releaseYear: number | null;
  posterUrl: string | null;
  voteAverage: number | null;
}

/** A summary with what the Home hero needs. */
export interface MovieCard extends MovieSummary {
  backdropUrl: string | null;
  overview: string;
}

export interface MovieList {
  movies: MovieCard[];
  /** TMDB failed with nothing cached: the list comes from the local catalog. */
  degraded: boolean;
}

export interface MoodResults extends MovieList {
  mood: { slug: string; label: string; description: string };
  page: number;
  hasMore: boolean;
}

export interface MovieDetail extends MovieSummary {
  originalTitle: string;
  overview: string;
  releaseDate: string | null;
  runtime: number | null;
  originalLanguage: string;
  backdropUrl: string | null;
  popularity: number;
  voteCount: number;
  genres: Genre[];
}

export interface Director {
  id: number;
  tmdbId: number;
  name: string;
  profileUrl: string | null;
}

export interface CastMember extends Director {
  character: string;
  order: number | null;
}

export interface MovieCredits {
  directors: Director[];
  cast: CastMember[];
}

export interface MovieSearchPage {
  query: string;
  page: number;
  totalPages: number;
  totalResults: number;
  results: MovieSummary[];
}

/** A streaming platform (TMDB watch provider) of the backend's region. */
export interface WatchProvider {
  tmdbId: number;
  name: string;
  logoUrl: string | null;
}

/** Where a movie can be watched in the region ("Dónde verla"). */
export interface MovieWatchProviders {
  region: string;
  /** TMDB's page with the offers (data by JustWatch), or null. */
  link: string | null;
  streaming: WatchProvider[];
  rent: WatchProvider[];
  buy: WatchProvider[];
}
