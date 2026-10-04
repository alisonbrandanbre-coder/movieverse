import { SearchX, Telescope } from "lucide-react";

import { getErrorMessage } from "@/api/client";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { Pagination } from "@/components/ui/Pagination";

import { SEARCH_MIN_LENGTH } from "../api";
import { useMovieSearch } from "../hooks";
import { MovieGrid } from "./MovieGrid";

interface SearchResultsProps {
  query: string;
  page: number;
  onPageChange: (page: number) => void;
}

export function SearchResults({ query, page, onPageChange }: SearchResultsProps) {
  const search = useMovieSearch(query, page);
  const trimmed = query.trim();

  if (trimmed.length < SEARCH_MIN_LENGTH) {
    return (
      <EmptyState
        icon={Telescope}
        title="¿Qué querés ver hoy?"
        description={`Escribí al menos ${SEARCH_MIN_LENGTH} caracteres para buscar una película.`}
      />
    );
  }
  if (search.isPending) return <LoadingState label="Buscando películas…" />;
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
