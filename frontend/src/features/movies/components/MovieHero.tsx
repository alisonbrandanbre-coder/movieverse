import type { MovieDetail } from "@/types/movie";
import { formatLanguage, formatRating, formatRuntime } from "@/utils/format";

import { MovieActions } from "./MovieActions";
import { PosterImage } from "./PosterImage";

export function MovieHero({ movie }: { movie: MovieDetail }) {
  const runtime = formatRuntime(movie.runtime);
  const rating = formatRating(movie.voteAverage);
  const showOriginalTitle = movie.originalTitle && movie.originalTitle !== movie.title;
  const meta = [movie.releaseYear, runtime, movie.originalLanguage && formatLanguage(movie.originalLanguage)].filter(
    Boolean,
  );

  return (
    <section className="relative isolate">
      {movie.backdropUrl && (
        <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[30rem] overflow-hidden mask-b-from-35% mask-b-to-100% sm:h-[38rem]">
          <img src={movie.backdropUrl} alt="" className="size-full object-cover opacity-55" />
          <div className="absolute inset-0 bg-linear-to-b from-base/20 via-base/60 to-base/90" />
          <div className="absolute inset-0 bg-linear-to-r from-base/80 via-transparent to-base/40" />
        </div>
      )}
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pb-6 pt-20 sm:flex-row sm:items-start sm:px-6 sm:pt-40">
        <PosterImage
          src={movie.posterUrl}
          alt={`Póster de ${movie.title}`}
          title={movie.title}
          className="w-44 shrink-0 rounded-poster border border-line-strong shadow-poster sm:w-64"
        />
        <div className="flex animate-fade-up flex-col gap-4 sm:pt-6">
          <div>
            <h1 className="font-display text-5xl leading-none tracking-wide text-fg sm:text-7xl">{movie.title}</h1>
            {showOriginalTitle && <p className="mt-1 text-sm text-fg-muted">Título original: {movie.originalTitle}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {rating && (
              <span className="flex items-baseline gap-1.5" aria-label={`Puntuación ${rating} de 10`}>
                <span aria-hidden className="text-lg text-gold">
                  ★
                </span>
                <strong className="text-2xl font-extrabold text-gold">{rating}</strong>
                <span className="text-sm text-fg-muted">({movie.voteCount.toLocaleString("es")} votos)</span>
              </span>
            )}
            {meta.length > 0 && (
              <p className="text-sm font-semibold text-fg-secondary">
                {meta.map((item, index) => (
                  <span key={String(item)}>
                    {index > 0 && (
                      <span aria-hidden className="mx-2 text-violet-light">
                        ·
                      </span>
                    )}
                    {item}
                  </span>
                ))}
              </p>
            )}
          </div>
          {movie.genres.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Géneros">
              {movie.genres.map((genre) => (
                <li
                  key={genre.id}
                  className="rounded-full border border-violet-light/40 bg-violet/15 px-3 py-1 text-xs font-bold text-violet-soft"
                >
                  {genre.name}
                </li>
              ))}
            </ul>
          )}
          <section aria-labelledby="overview-heading" className="max-w-3xl">
            <h2 id="overview-heading" className="eyebrow mb-2">
              Sinopsis
            </h2>
            <p className="text-lg leading-relaxed text-fg-secondary">{movie.overview || "Sin sinopsis disponible."}</p>
          </section>
          <div className="mt-2">
            <MovieActions />
          </div>
        </div>
      </div>
    </section>
  );
}
