import { SearchX, Sparkles, TrendingUp } from "lucide-react";

import { getErrorMessage } from "@/api/client";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { InlineError } from "@/components/ui/InlineError";
import { MovieGridSkeleton } from "@/components/ui/Skeleton";
import { useRecommendations } from "@/features/recommendations/hooks";

import { SEARCH_MIN_LENGTH } from "../api";
import { hasFilters, NO_FILTERS, type MovieFilters } from "../filters";
import { useMovieSearch, useTrending } from "../hooks";
import { FilteredMovies, NoMatches, ResultsGrid } from "./FilteredMovies";
import { MovieCarousel } from "./MovieCarousel";

/** Before typing: something to start from instead of an empty page. */
function SearchSuggestions() {
  const trending = useTrending();
  const recommendations = useRecommendations();
  const forYou = recommendations.data?.sections.find((s) => s.key === "FOR_YOU")?.movies.slice(0, 12);
  return (
    <div className="flex flex-col gap-12">
      <MovieCarousel
        title="Tendencias de la semana"
        description="¿No sabés qué buscar? Empezá por lo que se está viendo."
        icon={TrendingUp}
        movies={trending.data?.movies}
        fallback={
          trending.isError ? (
            <InlineError message={getErrorMessage(trending.error, "No pudimos cargar las tendencias.")} onRetry={() => trending.refetch()} />
          ) : undefined
        }
      />
      {!recommendations.isError && (
        <MovieCarousel title="Para vos" description="Las primeras de tus recomendaciones." icon={Sparkles} movies={forYou} />
      )}
    </div>
  );
}

interface SearchResultsProps {
  query: string;
  page: number;
  onPageChange: (page: number) => void;
  filters?: MovieFilters;
  onClearFilters?: () => void;
}

/**
 * Results of Buscar: with a text, TMDB's search (filtered by the backend when there are
 * filters); without a text, the filtered catalog or, with no filters, some suggestions.
 */
export function SearchResults({ query, page, onPageChange, filters = NO_FILTERS, onClearFilters = () => undefined }: SearchResultsProps) {
  const trimmed = query.trim();
  const hasText = trimmed.length >= SEARCH_MIN_LENGTH;
  const filtered = hasFilters(filters);
  const search = useMovieSearch(hasText ? trimmed : "", page, filters);

  if (!hasText) {
    return filtered ? (
      <FilteredMovies filters={filters} page={page} onPageChange={onPageChange} onClearFilters={onClearFilters} />
    ) : (
      <SearchSuggestions />
    );
  }
  if (search.isPending) return <MovieGridSkeleton label="Buscando películas…" />;
  if (search.isError) {
    return (
      <ErrorState
        title="No pudimos completar la búsqueda"
        message={getErrorMessage(search.error)}
        onRetry={() => search.refetch()}
      />
    );
  }

  const { results, totalResults } = search.data;
  if (results.length === 0) {
    return filtered ? (
      <NoMatches
        description={`Ninguna película para “${trimmed}” cumple esos filtros. Probá sacando alguno.`}
        onClearFilters={onClearFilters}
      />
    ) : (
      <EmptyState
        icon={SearchX}
        title="Sin resultados"
        description={`No encontramos películas para “${trimmed}”. Probá con otro título.`}
      />
    );
  }

  return (
    <ResultsGrid
      data={search.data}
      stale={search.isPlaceholderData}
      page={page}
      onPageChange={onPageChange}
      label={`${totalResults.toLocaleString("es")} ${totalResults === 1 ? "resultado" : "resultados"} para “${trimmed}”${filtered ? " con estos filtros" : ""}`}
    />
  );
}
