import { SearchX, Telescope } from "lucide-react";

import { getErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";

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
      {totalPages > 1 && (
        <nav aria-label="Paginación" className="flex items-center justify-center gap-3">
          <Button variant="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Anterior
          </Button>
          <span className="text-sm text-fg-muted">
            Página {page} de {totalPages}
          </span>
          <Button variant="secondary" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            Siguiente
          </Button>
        </nav>
      )}
    </div>
  );
}
