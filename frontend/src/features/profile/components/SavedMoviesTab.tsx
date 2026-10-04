import { Bookmark, Eye, Heart, Search, X, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { getErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { buttonClasses } from "@/components/ui/buttonClasses";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { MovieGridSkeleton } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { useSavedMovies, useToggleInteraction } from "@/features/interactions/hooks";
import { MovieGrid } from "@/features/movies/components/MovieGrid";
import type { InteractionType, SavedListKind } from "@/types/interactions";
import type { MovieSummary } from "@/types/movie";

interface ListConfig {
  type: InteractionType;
  listName: string;
  emptyTitle: string;
  emptyDescription: string;
  icon: LucideIcon;
}

const SAVED_LISTS: Record<SavedListKind, ListConfig> = {
  favorites: {
    type: "FAVORITE",
    listName: "favoritas",
    emptyTitle: "Todavía no tenés favoritas",
    emptyDescription: "Tocá «Favorita» en la ficha de una película para guardarla acá.",
    icon: Heart,
  },
  watchlist: {
    type: "WATCHLIST",
    listName: "pendientes",
    emptyTitle: "No tenés pendientes",
    emptyDescription: "Guardá lo que querés ver más adelante con el botón «Pendiente».",
    icon: Bookmark,
  },
  watched: {
    type: "WATCHED",
    listName: "vistas",
    emptyTitle: "No marcaste películas vistas",
    emptyDescription: "Marcá las que ya viste: así no te las vamos a recomendar.",
    icon: Eye,
  },
};

function RemoveButton({ movie, config }: { movie: MovieSummary; config: ListConfig }) {
  const toggle = useToggleInteraction(movie.id);
  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        disabled={toggle.isPending}
        aria-label={`Quitar ${movie.title} de ${config.listName}`}
        onClick={() => toggle.mutate({ type: config.type, active: false })}
      >
        <X className="size-4" aria-hidden />
        {toggle.isPending ? "Quitando…" : "Quitar"}
      </Button>
      {toggle.isError && (
        <p role="alert" className="text-xs text-danger">
          {getErrorMessage(toggle.error, "No pudimos quitarla.")}
        </p>
      )}
    </div>
  );
}

export function SavedMoviesTab({ kind }: { kind: SavedListKind }) {
  const [page, setPage] = useState(1);
  const list = useSavedMovies(kind, page);
  const config = SAVED_LISTS[kind];

  if (list.isPending) return <MovieGridSkeleton count={5} label={`Cargando tus ${config.listName}…`} />;
  if (list.isError) {
    return (
      <ErrorState
        title={`No pudimos cargar tus ${config.listName}`}
        message={getErrorMessage(list.error)}
        onRetry={() => list.refetch()}
      />
    );
  }
  const { results, totalPages, totalResults } = list.data;
  if (results.length === 0) {
    // The last movie of a later page was removed: go back one page.
    if (page > 1) {
      setPage(page - 1);
      return null;
    }
    return (
      <Card className="px-6">
        <EmptyState icon={config.icon} title={config.emptyTitle} description={config.emptyDescription}>
          <Link to="/search" className={buttonClasses({ size: "lg" })}>
            <Search className="size-4" aria-hidden />
            Buscar películas
          </Link>
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className={`flex flex-col gap-6 transition-opacity ${list.isPlaceholderData ? "opacity-60" : ""}`}>
      <p className="text-sm text-fg-secondary">
        {totalResults} {totalResults === 1 ? "película" : "películas"}
      </p>
      <MovieGrid movies={results} renderAction={(movie) => <RemoveButton movie={movie} config={config} />} />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
