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
