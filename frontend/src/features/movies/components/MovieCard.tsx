import { Orbit } from "lucide-react";
import { Link } from "react-router";

import type { MovieSummary } from "@/types/movie";
import { formatRating } from "@/utils/format";

import { PosterImage } from "./PosterImage";

export function MovieCard({ movie }: { movie: MovieSummary }) {
  const rating = formatRating(movie.voteAverage);

  return (
    <Link
      to={`/movies/${movie.id}`}
      className="group flex flex-col gap-3 rounded-poster focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
    >
      <div className="relative overflow-hidden rounded-poster border border-line bg-raised shadow-poster transition duration-300 group-hover:-translate-y-1.5 group-hover:border-focus group-hover:shadow-glow-strong group-focus-visible:-translate-y-1.5 group-focus-visible:border-focus">
        <PosterImage src={movie.posterUrl} alt={`Póster de ${movie.title}`} title={movie.title} className="w-full" />
        <span
          aria-hidden
          className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full border border-violet-light/50 bg-deep/80 px-2.5 py-1 text-[11px] font-bold text-fg opacity-0 backdrop-blur-md transition group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <Orbit className="size-3.5 text-violet-soft" />
          Explorar universo
        </span>
      </div>
      <div className="flex flex-col gap-1 px-0.5">
        <h3 className="line-clamp-2 text-sm font-bold text-fg transition-colors group-hover:text-violet-soft">{movie.title}</h3>
        <div className="flex items-center justify-between text-xs text-fg-muted">
          <span>{movie.releaseYear ?? "Sin fecha"}</span>
          {rating && (
            <span className="flex items-center gap-1 font-bold text-gold" aria-label={`Puntuación ${rating}`}>
              <span aria-hidden>★</span>
              {rating}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
