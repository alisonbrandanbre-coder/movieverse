import { Clock, Star } from "lucide-react";

import type { MovieDetail } from "@/types/movie";
import { formatLanguage, formatRating, formatRuntime } from "@/utils/format";

import { MovieActions } from "./MovieActions";
import { PosterImage } from "./PosterImage";

export function MovieHero({ movie }: { movie: MovieDetail }) {
  const runtime = formatRuntime(movie.runtime);
  const rating = formatRating(movie.voteAverage);
  const showOriginalTitle = movie.originalTitle && movie.originalTitle !== movie.title;

  return (
    <section className="relative isolate overflow-hidden">
      {movie.backdropUrl && (
        <img
          src={movie.backdropUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 -z-10 size-full object-cover opacity-25"
        />
      )}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/40" />
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-end">
        <PosterImage
          src={movie.posterUrl}
          alt={`Póster de ${movie.title}`}
          className="w-40 shrink-0 rounded-xl shadow-2xl sm:w-56"
        />
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            {movie.title}
            {movie.releaseYear && <span className="ml-2 font-normal text-slate-400">({movie.releaseYear})</span>}
          </h1>
          {showOriginalTitle && <p className="text-sm text-slate-400">Título original: {movie.originalTitle}</p>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-300">
            {rating && (
              <span className="flex items-center gap-1" aria-label={`Puntuación ${rating} de 10`}>
                <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />
                <strong className="text-white">{rating}</strong>
                <span className="text-slate-500">({movie.voteCount.toLocaleString("es")} votos)</span>
              </span>
            )}
            {runtime && (
              <span className="flex items-center gap-1">
                <Clock className="size-4" aria-hidden />
                {runtime}
              </span>
            )}
            {movie.originalLanguage && <span>{formatLanguage(movie.originalLanguage)}</span>}
          </div>
          {movie.genres.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Géneros">
              {movie.genres.map((genre) => (
                <li key={genre.id} className="rounded-full bg-violet-500/15 px-3 py-1 text-xs font-medium text-violet-200">
                  {genre.name}
                </li>
              ))}
            </ul>
          )}
          <MovieActions />
        </div>
      </div>
    </section>
  );
}
