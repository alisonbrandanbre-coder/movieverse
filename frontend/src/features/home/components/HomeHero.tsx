import { ExternalLink, Orbit } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import { buttonClasses } from "@/components/ui/buttonClasses";
import { Skeleton } from "@/components/ui/Skeleton";
import type { MovieCard } from "@/types/movie";
import { formatRating } from "@/utils/format";

const ROTATE_MS = 7000;
const HERO_SLIDES = 4;

function prefersReducedMotion(): boolean {
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

/** Two short sentences at most: the hero is not the detail page. */
function shortOverview(text: string): string {
  if (text.length <= 220) return text;
  const cut = text.slice(0, 220);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(". ") + 1, cut.lastIndexOf(" ")))}…`;
}

/**
 * Full-width hero with the backdrops of 4 trending movies. Rotates every 7 s with a
 * cross-fade (paused on hover or keyboard focus, and never with reduced motion); dots
 * pick a slide. The text sits on a gradient towards the page background so it reads on
 * any image.
 */
export function HomeHero({ movies }: { movies: MovieCard[] | undefined }) {
  const slides = (movies ?? []).filter((m) => m.backdropUrl).slice(0, HERO_SLIDES);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced] = useState(prefersReducedMotion);
  const count = slides.length;

  useEffect(() => {
    if (paused || reduced || count < 2) return;
    const timer = window.setTimeout(() => setActive((current) => (current + 1) % count), ROTATE_MS);
    return () => window.clearTimeout(timer);
  }, [active, paused, reduced, count]);

  if (movies === undefined) {
    return (
      <div role="status" aria-label="Cargando películas destacadas" className="relative h-[68vh] min-h-[26rem] max-h-[44rem] w-full overflow-hidden">
        <Skeleton className="absolute inset-0 rounded-none opacity-60" />
        <div className="absolute inset-x-0 bottom-0 mx-auto flex max-w-6xl flex-col gap-4 px-4 pb-14 sm:px-6">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-14 w-3/4 max-w-xl" />
          <Skeleton className="h-4 w-full max-w-lg" />
          <Skeleton className="h-4 w-2/3 max-w-md" />
        </div>
      </div>
    );
  }
  if (count === 0) return null;
  const current = slides[Math.min(active, count - 1)];

  return (
    <section
      aria-roledescription="carrusel"
      aria-label="Películas en tendencia"
      className="relative h-[68vh] min-h-[26rem] max-h-[44rem] w-full overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && setPaused(false)}
    >
      {/* Backdrops stacked; only the active one is visible (cross-fade). */}
      {slides.map((movie, index) => (
        <div
          key={movie.id}
          aria-hidden
          className={`absolute inset-0 transition-opacity duration-1000 ease-out ${index === active ? "opacity-100" : "opacity-0"}`}
        >
          <img
            src={movie.backdropUrl ?? undefined}
            alt=""
            className={`size-full object-cover object-[center_25%] ${index === active ? "animate-hero-zoom" : ""}`}
            loading={index === 0 ? "eager" : "lazy"}
          />
        </div>
      ))}
      <div aria-hidden className="absolute inset-0 bg-linear-to-t from-base via-base/70 to-base/10" />
      <div aria-hidden className="absolute inset-0 bg-linear-to-r from-base/90 via-base/40 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
        <div key={current.id} aria-live={paused ? "polite" : "off"} className="flex max-w-2xl animate-fade-up flex-col gap-3">
          <p className="eyebrow">Tendencia de la semana</p>
          <h2 className="font-display text-5xl leading-[0.95] tracking-wide text-fg drop-shadow-[0_2px_16px_var(--color-deep)] sm:text-7xl">
            {current.title}
          </h2>
          <div className="flex items-center gap-3 text-sm font-semibold text-fg-secondary">
            {current.releaseYear && <span>{current.releaseYear}</span>}
            {formatRating(current.voteAverage) && (
              <span className="flex items-center gap-1 font-bold text-gold" aria-label={`Puntuación ${formatRating(current.voteAverage)}`}>
                <span aria-hidden>★</span>
                {formatRating(current.voteAverage)}
              </span>
            )}
          </div>
          {current.overview && (
            <p className="line-clamp-3 max-w-xl text-md leading-relaxed text-fg-secondary">{shortOverview(current.overview)}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-3">
            <Link to={`/movies/${current.id}`} className={buttonClasses({ size: "lg" })}>
              <ExternalLink className="size-4" aria-hidden />
              Ver ficha
            </Link>
            <Link to={`/universe/${current.id}`} className={buttonClasses({ variant: "secondary", size: "lg" })}>
              <Orbit className="size-4" aria-hidden />
              Explorar universo
            </Link>
          </div>
        </div>

        {count > 1 && (
          <div className="mt-6 flex items-center gap-2" role="group" aria-label="Elegir película destacada">
            {slides.map((movie, index) => (
              <button
                key={movie.id}
                type="button"
                onClick={() => setActive(index)}
                aria-label={`Mostrar ${movie.title} (${index + 1} de ${count})`}
                aria-current={index === active}
                className={`h-2.5 rounded-full transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                  index === active ? "w-8 bg-violet-light" : "w-2.5 bg-fg-muted/50 hover:bg-fg-muted"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
