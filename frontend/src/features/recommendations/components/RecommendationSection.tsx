import { CircleHelp, type LucideIcon } from "lucide-react";

import { Disclosure } from "@/components/ui/Disclosure";
import { MovieGrid } from "@/features/movies/components/MovieGrid";
import type { RecommendedMovie } from "@/types/recommendations";

interface RecommendationSectionProps {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  movies: RecommendedMovie[];
  /** Shown instead of the grid when the API returned no movies for this section. */
  emptyText: string;
}

/** A Discover section: title + grid of recommended movies, each with its "¿Por qué?". */
export function RecommendationSection({ id, title, description, icon: Icon, movies, emptyText }: RecommendationSectionProps) {
  const headingId = `${id}-title`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-5">
      <header className="flex items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border border-violet-light/40 bg-violet/15">
          <Icon className="size-5 text-violet-soft" aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id={headingId} className="font-display text-3xl leading-none tracking-wide text-fg">
            {title}
          </h2>
          <p className="text-sm text-fg-secondary">{description}</p>
        </div>
      </header>
      {movies.length === 0 ? (
        <p className="rounded-card border border-dashed border-line px-5 py-6 text-sm text-fg-muted">{emptyText}</p>
      ) : (
        <MovieGrid
          movies={movies}
          renderAction={(movie) => (
            <Disclosure label="¿Por qué?" ariaLabel={`¿Por qué ${movie.title}?`} icon={CircleHelp}>
              {movie.explanation}
            </Disclosure>
          )}
        />
      )}
    </section>
  );
}
