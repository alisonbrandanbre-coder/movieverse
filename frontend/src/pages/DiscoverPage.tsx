import { Compass, Gem, Info, RefreshCw, Route, Search, Sparkles, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { getErrorMessage } from "@/api/client";
import { PageContainer, PageHeader } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { buttonClasses } from "@/components/ui/buttonClasses";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { MovieGridSkeleton } from "@/components/ui/Skeleton";
import { FilteredMovies } from "@/features/movies/components/FilteredMovies";
import { MovieFilterPanel } from "@/features/movies/components/MovieFilterPanel";
import { hasFilters } from "@/features/movies/filters";
import { useFilterParams } from "@/features/movies/useFilterParams";
import { RecommendationSection } from "@/features/recommendations/components/RecommendationSection";
import { SurpriseButton } from "@/features/recommendations/components/Surprise";
import { useRecommendations, useRefreshRecommendations } from "@/features/recommendations/hooks";
import type { RecommendationSectionKey } from "@/types/recommendations";

const SECTIONS: Record<RecommendationSectionKey, { title: string; description: string; icon: LucideIcon; emptyText: string }> = {
  FOR_YOU: {
    title: "Para vos",
    description: "Lo que mejor encaja con tus gustos, con algunas sorpresas.",
    icon: Sparkles,
    emptyText: "Todavía no encontramos películas para vos. Probá refrescar en un rato.",
  },
  HIDDEN_GEMS: {
    title: "Joyas para descubrir",
    description: "Menos conocidas, pero muy bien valoradas.",
    icon: Gem,
    emptyText: "Por ahora no hay joyas nuevas para mostrarte.",
  },
  KEEP_EXPLORING: {
    title: "Continuá explorando",
    description: "A partir de tus favoritas y de lo que te gustó.",
    icon: Route,
    emptyText: "Marcá favoritas o tocá «Me gusta» en algunas películas para ver más acá.",
  },
};

/**
 * Descubrir: the user's recommendations in three sections. With filters (in the URL), the
 * catalog matching them (TMDB discover) replaces the sections until they are cleared.
 */
export function DiscoverPage() {
  const recommendations = useRecommendations();
  const refresh = useRefreshRecommendations();
  const [refreshed, setRefreshed] = useState(false);
  const { filters, page, setFilters, setPage, clearFilters } = useFilterParams();

  const header = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <PageHeader
        eyebrow="Tu universo"
        title="Descubrir"
        description="Películas elegidas para vos y joyas menos obvias, conectadas por lo que más te gusta."
      />
      {recommendations.isSuccess && (
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          <SurpriseButton />
          <Button
            variant="secondary"
            disabled={refresh.isPending}
            onClick={() => refresh.mutate(undefined, { onSuccess: () => setRefreshed(true) })}
          >
            <RefreshCw className={`size-4 ${refresh.isPending ? "animate-spin" : ""}`} aria-hidden />
            {refresh.isPending ? "Actualizando…" : "Refrescar"}
          </Button>
        </div>
      )}
    </div>
  );

  const filterPanel = <MovieFilterPanel filters={filters} onChange={setFilters} />;

  if (hasFilters(filters)) {
    return (
      <PageContainer className="flex flex-col gap-8">
        {header}
        {filterPanel}
        <FilteredMovies filters={filters} page={page} onPageChange={setPage} onClearFilters={clearFilters} />
      </PageContainer>
    );
  }

  if (recommendations.isPending) {
    return (
      <PageContainer className="flex flex-col gap-8">
        {header}
        {filterPanel}
        <MovieGridSkeleton label="Buscando películas para vos…" />
      </PageContainer>
    );
  }
  if (recommendations.isError) {
    return (
      <PageContainer className="flex flex-col gap-8">
        {header}
        {filterPanel}
        <ErrorState
          title="No pudimos cargar tus recomendaciones"
          message={getErrorMessage(recommendations.error)}
          onRetry={() => recommendations.refetch()}
        />
      </PageContainer>
    );
  }

  const { sections, notice, isFallback } = recommendations.data;
  const isEmpty = sections.every((section) => section.movies.length === 0);

  return (
    <PageContainer className="flex flex-col gap-10">
      {header}
      {filterPanel}

      <p role="status" className={`-mt-6 min-h-5 text-sm ${refresh.isError ? "text-danger" : "text-violet-soft"}`}>
        {refresh.isError
          ? getErrorMessage(refresh.error, "No pudimos refrescar tus recomendaciones.")
          : refreshed && !refresh.isPending
            ? "Recomendaciones actualizadas."
            : ""}
      </p>

      {notice && (
        <Card variant="solid" className="-mt-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-3 text-sm text-fg-secondary">
            <Info className="mt-0.5 size-5 shrink-0 text-violet-soft" aria-hidden />
            {notice}
          </p>
          {isFallback && (
            <Link to="/onboarding" className={`${buttonClasses({ size: "sm" })} shrink-0`}>
              Completar onboarding
            </Link>
          )}
        </Card>
      )}

      {isEmpty ? (
        <Card className="px-6">
          <EmptyState
            icon={Compass}
            title="Todavía no hay recomendaciones"
            description="Buscá y marcá películas que te gusten: cada una suma una estrella a tu constelación."
          >
            <Link to="/search" className={buttonClasses({ size: "lg" })}>
              <Search className="size-4" aria-hidden />
              Buscar películas
            </Link>
          </EmptyState>
        </Card>
      ) : (
        <div className={`flex flex-col gap-14 transition-opacity ${refresh.isPending ? "opacity-60" : ""}`}>
          {sections.map((section) => (
            <RecommendationSection
              key={section.key}
              id={`section-${section.key.toLowerCase()}`}
              movies={section.movies}
              {...SECTIONS[section.key]}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
