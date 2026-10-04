import type { MovieSummary } from "@/types/movie";

import { MovieCard } from "./MovieCard";

export function MovieGrid({ movies }: { movies: MovieSummary[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4 lg:grid-cols-5">
      {movies.map((movie) => (
        <li key={movie.id}>
          <MovieCard movie={movie} />
        </li>
      ))}
    </ul>
  );
}
