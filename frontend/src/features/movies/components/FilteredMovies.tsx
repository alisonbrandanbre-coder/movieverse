import { SearchX, X } from "lucide-react";

import { getErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { MovieGridSkeleton } from "@/components/ui/Skeleton";
import type { MovieSearchPage } from "@/types/movie";

import { hasFilters, type MovieFilters, type SortOrder } from "../filters";
import { useMovieDiscover } from "../hooks";
import { MovieGrid } from "./MovieGrid";

interface ResultsProps {
  page: number;
  onPageChange: (page: number) => void;
  onClearFilters: () => void;
}

/** The empty result of a filtered list, with a way out. */
export function NoMatches({ description, onClearFilters }: { description: string; onClearFilters: () => void }) {
  return (
    <EmptyState icon={SearchX} title="Ninguna película coincide" description={description}>
      <Button variant="secondary" onClick={onClearFilters}>
        <X className="size-4" aria-hidden />
        Limpiar filtros
      </Button>
    </EmptyState>
  );
}

/** Count, grid and pagination of one page of results (search or discover). */
export function ResultsGrid({
  data,
  label,
  stale,
  page,
  onPageChange,
}: {
  data: MovieSearchPage;
  label: string;
  stale: boolean;
  page: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className={`flex flex-col gap-6 transition-opacity ${stale ? "opacity-60" : ""}`}>
      <p className="text-sm text-fg-secondary" aria-live="polite">
        {label}
      </p>
      <MovieGrid movies={data.results} />
      <Pagination page={page} totalPages={data.totalPages} onPageChange={onPageChange} />
    </div>
  );
}

const SORT_PHRASES: Record<SortOrder, string> = {
  relevance: "por relevancia",
  rating: "de mejor a peor puntaje",
  newest: "de las más recientes a las más antiguas",
  oldest: "de las más antiguas a las más recientes",
  popular: "de las más populares a las menos",
};

/** Movies matching the filters (or in another order) without a text (TMDB discover). */
export function FilteredMovies({ filters, page, onPageChange, onClearFilters }: ResultsProps & { filters: MovieFilters }) {
  const discover = useMovieDiscover(filters, page);

  if (discover.isPending) return <MovieGridSkeleton label="Buscando películas con esos filtros…" />;
  if (discover.isError) {
    return (
      <ErrorState
        title="No pudimos aplicar los filtros"
        message={getErrorMessage(discover.error)}
        onRetry={() => discover.refetch()}
      />
    );
  }
  const { totalResults } = discover.data;
  if (discover.data.results.length === 0) {
    return <NoMatches description="Probá sacando algún filtro: menos géneros o plataformas, otra duración o década." onClearFilters={onClearFilters} />;
  }
  return (
    <ResultsGrid
      data={discover.data}
      stale={discover.isPlaceholderData}
      page={page}
      onPageChange={onPageChange}
      label={`${totalResults.toLocaleString("es")} ${totalResults === 1 ? "película" : "películas"}${hasFilters(filters) ? " con estos filtros" : ""}, ${SORT_PHRASES[filters.sort]}`}
    />
  );
}
