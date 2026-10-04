import { Orbit } from "lucide-react";
import { Link } from "react-router";

import type { MovieSummary } from "@/types/movie";
import { formatRating } from "@/utils/format";

import { PosterImage } from "./PosterImage";

/** Where the card leads: the movie's detail (with an "Explorar universo" shortcut) or straight to its map. */
export type MovieCardDestination = "detail" | "universe";

interface MovieCardProps {
  movie: MovieSummary;
  destination?: MovieCardDestination;
}

export function MovieCard({ movie, destination = "detail" }: MovieCardProps) {
  const rating = formatRating(movie.voteAverage);
  const toUniverse = destination === "universe";

  return (
    <div className="group relative">
      <Link
        to={toUniverse ? `/universe/${movie.id}` : `/movies/${movie.id}`}
        aria-label={toUniverse ? `Explorar el universo de ${movie.title}` : undefined}
        className="flex flex-col gap-3 rounded-poster focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
      >
        <div className="relative overflow-hidden rounded-poster border border-line bg-raised shadow-poster transition duration-300 group-hover:-translate-y-1.5 group-hover:border-focus group-hover:shadow-glow-strong group-focus-within:-translate-y-1.5 group-focus-within:border-focus">
          <PosterImage src={movie.posterUrl} alt={`Póster de ${movie.title}`} title={movie.title} className="w-full" />
          {toUniverse && (
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-linear-to-t from-deep/95 to-transparent px-2 pb-2.5 pt-8 text-xs font-bold text-fg opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
            >
              <Orbit className="size-3.5 text-violet-soft" />
              Empezar acá
            </span>
          )}
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
      {/* Its own link (a link can't nest another): on top of the poster, moving with it. */}
      {!toUniverse && (
        <Link
          to={`/universe/${movie.id}`}
          aria-label={`Explorar universo de ${movie.title}`}
          className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full border border-violet-light/50 bg-deep/80 px-2.5 py-1 text-[11px] font-bold text-fg opacity-0 backdrop-blur-md transition duration-300 hover:border-violet-light hover:bg-violet/40 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-focus group-hover:-translate-y-1.5 group-hover:opacity-100 group-focus-within:-translate-y-1.5 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <Orbit className="size-3.5 text-violet-soft" aria-hidden />
          Explorar universo
        </Link>
      )}
    </div>
  );
}
