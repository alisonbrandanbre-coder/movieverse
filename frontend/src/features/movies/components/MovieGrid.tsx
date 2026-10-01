import type { MovieSummary } from "@/types/movie";

import { MovieCard } from "./MovieCard";

export function MovieGrid({ movies }: { movies: MovieSummary[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {movies.map((movie) => (
        <li key={movie.id}>
          <MovieCard movie={movie} />
        </li>
      ))}
    </ul>
  );
}
