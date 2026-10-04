import { SearchX, Sparkles, TrendingUp } from "lucide-react";

import { getErrorMessage } from "@/api/client";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { MovieGridSkeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";

import { SEARCH_MIN_LENGTH } from "../api";
import { InlineError } from "@/components/ui/InlineError";
import { useRecommendations } from "@/features/recommendations/hooks";

import { useMovieSearch, useTrending } from "../hooks";
import { MovieCarousel } from "./MovieCarousel";
import { MovieGrid } from "./MovieGrid";

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
}

export function SearchResults({ query, page, onPageChange }: SearchResultsProps) {
  const search = useMovieSearch(query, page);
  const trimmed = query.trim();

  if (trimmed.length < SEARCH_MIN_LENGTH) return <SearchSuggestions />;
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

  const { results, totalResults, totalPages } = search.data;
  if (results.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title="Sin resultados"
        description={`No encontramos películas para “${trimmed}”. Probá con otro título.`}
      />
    );
  }

  return (
    <div className={`flex flex-col gap-6 transition-opacity ${search.isPlaceholderData ? "opacity-60" : ""}`}>
      <p className="text-sm text-fg-secondary" aria-live="polite">
        {totalResults.toLocaleString("es")} {totalResults === 1 ? "resultado" : "resultados"} para “{trimmed}”
      </p>
      <MovieGrid movies={results} />
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </div>
  );
}
