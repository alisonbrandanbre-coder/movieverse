import type { ReactNode } from "react";

import type { MovieSummary } from "@/types/movie";

import { MovieCard } from "./MovieCard";

interface MovieGridProps<T extends MovieSummary> {
  movies: T[];
  /** Optional control under each card (e.g. "Quitar" in the profile lists). Kept outside the card's link. */
  renderAction?: (movie: T) => ReactNode;
}

export function MovieGrid<T extends MovieSummary>({ movies, renderAction }: MovieGridProps<T>) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4 lg:grid-cols-5">
      {movies.map((movie) => (
        <li key={movie.id} className="flex flex-col gap-2">
          <MovieCard movie={movie} />
          {renderAction?.(movie)}
        </li>
      ))}
    </ul>
  );
}
