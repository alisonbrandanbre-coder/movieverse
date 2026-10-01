export const INTERSTELLAR_SUMMARY_DTO = {
  id: 1,
  tmdb_id: 157336,
  title: "Interstellar",
  release_year: 2014,
  poster_url: "https://image.tmdb.org/t/p/w500/interstellar.jpg",
  vote_average: 8.4,
};

export const SEARCH_DTO = {
  query: "interstellar",
  page: 1,
  total_pages: 1,
  total_results: 2,
  results: [
    INTERSTELLAR_SUMMARY_DTO,
    { id: 2, tmdb_id: 301959, title: "Interstellar: Nolan's Odyssey", release_year: null, poster_url: null, vote_average: 0 },
  ],
};

export const EMPTY_SEARCH_DTO = { query: "zzzz", page: 1, total_pages: 0, total_results: 0, results: [] };

export const INTERSTELLAR_DETAIL_DTO = {
  ...INTERSTELLAR_SUMMARY_DTO,
  original_title: "Interstellar",
  overview: "Un grupo de exploradores viaja a través de un agujero de gusano.",
  release_date: "2014-11-05",
  runtime: 169,
  original_language: "en",
  backdrop_url: "https://image.tmdb.org/t/p/w1280/backdrop.jpg",
  popularity: 140.5,
  vote_count: 35000,
  genres: [
    { id: 1, name: "Ciencia ficción" },
    { id: 2, name: "Drama" },
  ],
};

export const INTERSTELLAR_CREDITS_DTO = {
  directors: [{ id: 10, tmdb_id: 525, name: "Christopher Nolan", profile_url: null }],
  cast: [
    { id: 20, tmdb_id: 10297, name: "Matthew McConaughey", character: "Cooper", profile_url: null, order: 0 },
    { id: 21, tmdb_id: 1813, name: "Anne Hathaway", character: "Brand", profile_url: null, order: 1 },
  ],
};
