import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Carousel } from "@/components/ui/Carousel";
import { CarouselSkeleton } from "@/components/ui/Skeleton";
import type { MovieSummary } from "@/types/movie";

import { MovieCard } from "./MovieCard";

interface MovieCarouselProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  /** `undefined` while loading: a skeleton row is shown. */
  movies: MovieSummary[] | undefined;
  /** Shown instead of the row when it failed (e.g. an `ErrorState` or a short note). */
  fallback?: ReactNode;
}

/** A `Carousel` of `MovieCard`s, appearing one after the other. */
export function MovieCarousel({ title, description, icon, action, movies, fallback }: MovieCarouselProps) {
  return (
    <Carousel title={title} description={description} icon={icon} action={action}>
      {fallback ??
        (movies === undefined ? (
          <CarouselSkeleton label={`Cargando ${title.toLowerCase()}…`} />
        ) : (
          movies.map((movie, index) => (
            <div
              key={movie.id}
              className="w-36 shrink-0 animate-card-in snap-start sm:w-44 lg:w-48"
              style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
            >
              <MovieCard movie={movie} />
            </div>
          ))
        ))}
    </Carousel>
  );
}
