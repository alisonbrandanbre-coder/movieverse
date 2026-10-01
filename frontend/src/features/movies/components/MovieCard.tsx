import { Star } from "lucide-react";
import { Link } from "react-router";

import type { MovieSummary } from "@/types/movie";
import { formatRating } from "@/utils/format";

import { PosterImage } from "./PosterImage";

export function MovieCard({ movie }: { movie: MovieSummary }) {
  const rating = formatRating(movie.voteAverage);

  return (
    <Link
      to={`/movies/${movie.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 transition hover:-translate-y-0.5 hover:border-violet-500/60 focus-visible:outline-2 focus-visible:outline-violet-400"
    >
      <PosterImage src={movie.posterUrl} alt={`Póster de ${movie.title}`} className="w-full" />
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-slate-100 group-hover:text-white">{movie.title}</h3>
        <div className="mt-auto flex items-center justify-between text-xs text-slate-400">
          <span>{movie.releaseYear ?? "Sin fecha"}</span>
          {rating && (
            <span className="flex items-center gap-1" aria-label={`Puntuación ${rating}`}>
              <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
              {rating}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
