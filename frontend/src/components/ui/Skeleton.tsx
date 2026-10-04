/**
 * Loading placeholders with a soft shimmer (instead of spinners) for content that has a
 * known shape: movie cards, grids, carousels and the movie detail. Decorative; each
 * group carries one `role="status"` with a readable label.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`block animate-shimmer rounded-control bg-skeleton ${className}`} />;
}

/** Poster (2:3) + title + year, like `MovieCard`. */
export function MovieCardSkeleton({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden className={`flex flex-col gap-3 ${className}`}>
      <Skeleton className="aspect-[2/3] w-full rounded-poster" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  );
}

/** Same columns as `MovieGrid`. */
export function MovieGridSkeleton({ count = 10, label = "Cargando películas…" }: { count?: number; label?: string }) {
  return (
    <div role="status" aria-label={label}>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
        {Array.from({ length: count }, (_, i) => (
          <li key={i}>
            <MovieCardSkeleton />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A row of cards, like `Carousel` with `MovieCard`s. */
export function CarouselSkeleton({ count = 6, label = "Cargando películas…" }: { count?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex gap-4 overflow-hidden sm:gap-5">
      {Array.from({ length: count }, (_, i) => (
        <MovieCardSkeleton key={i} className="w-36 shrink-0 sm:w-44 lg:w-48" />
      ))}
    </div>
  );
}

/** Movie detail: backdrop band, poster and the title / data / synopsis lines. */
export function MovieDetailSkeleton() {
  return (
    <div role="status" aria-label="Cargando película…" className="relative">
      <Skeleton className="h-64 w-full rounded-none opacity-50 sm:h-80" />
      <div className="mx-auto -mt-40 flex max-w-page flex-col gap-6 px-4 sm:-mt-48 sm:flex-row sm:px-6">
        <Skeleton className="aspect-[2/3] w-44 shrink-0 rounded-poster sm:w-60" />
        <div className="flex flex-1 flex-col gap-4 pt-4 sm:pt-28">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-24 rounded-full" />
            <Skeleton className="h-7 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}
