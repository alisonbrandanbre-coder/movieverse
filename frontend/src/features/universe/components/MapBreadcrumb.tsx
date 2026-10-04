import { ChevronRight } from "lucide-react";

import type { GraphMovie } from "@/types/graph";

interface MapBreadcrumbProps {
  path: GraphMovie[];
  onSelect: (movieId: number) => void;
}

/** The exploration path (Interstellar › Inception › Memento); each step goes back to it. */
export function MapBreadcrumb({ path, onSelect }: MapBreadcrumbProps) {
  return (
    <nav aria-label="Recorrido" className="max-w-full overflow-x-auto scrollbar-none rounded-full border border-line bg-surface px-2 py-1.5 shadow-card backdrop-blur-md">
      <ol className="flex items-center gap-0.5 whitespace-nowrap">
        {path.map((movie, index) => {
          const isLast = index === path.length - 1;
          return (
            <li key={movie.id} className="flex items-center gap-0.5">
              {index > 0 && <ChevronRight className="size-3.5 shrink-0 text-violet-light" aria-hidden />}
              <button
                type="button"
                onClick={() => onSelect(movie.id)}
                aria-current={isLast ? "step" : undefined}
                className={`max-w-44 truncate rounded-full px-2.5 py-1 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-focus ${
                  isLast ? "bg-violet/25 text-fg" : "text-fg-secondary hover:bg-violet/10 hover:text-fg"
                }`}
              >
                {movie.title}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
