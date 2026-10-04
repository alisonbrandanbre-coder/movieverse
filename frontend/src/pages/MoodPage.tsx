import { ArrowLeft, Info, SearchX, Sparkles } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router";

import { ApiError, getErrorMessage } from "@/api/client";
import { PageContainer } from "@/components/layout/PageContainer";
import { buttonClasses } from "@/components/ui/buttonClasses";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { MovieGridSkeleton } from "@/components/ui/Skeleton";
import { MOODS, moodStyle } from "@/features/moods/moods";
import { MovieGrid } from "@/features/movies/components/MovieGrid";
import { useMood } from "@/features/movies/hooks";

function readPage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/** `/mood/:slug`: movies for a mood of the Home. The backend decides what the mood means. */
export function MoodPage() {
  const { slug = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const page = readPage(params.get("page"));
  const style = moodStyle(slug);
  const mood = useMood(slug, page);
  const Icon = style?.icon ?? Sparkles;
  const notFound = mood.isError && mood.error instanceof ApiError && mood.error.code === "MOOD_NOT_FOUND";

  if (notFound) {
    return (
      <PageContainer>
        <EmptyState icon={SearchX} title="Ese estado de ánimo no existe" description="Elegí uno de los de la página de inicio.">
          <Link to="/" className={buttonClasses()}>
            <ArrowLeft className="size-4" aria-hidden />
            Volver al inicio
          </Link>
        </EmptyState>
      </PageContainer>
    );
  }

  const label = mood.data?.mood.label ?? style?.label ?? "Estado de ánimo";
  const description = mood.data?.mood.description ?? style?.tagline;

  return (
    <PageContainer className="flex flex-col gap-10">
      <header
        className={`relative flex flex-col gap-5 overflow-hidden rounded-card border bg-linear-to-br to-surface p-6 sm:flex-row sm:items-center sm:p-8 ${style?.tint ?? "border-line from-violet/15"}`}
      >
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full border border-line-strong bg-deep/50 sm:size-20">
          <Icon className={`size-8 sm:size-10 ${style?.text ?? "text-violet-soft"}`} aria-hidden />
        </span>
        <div className="flex flex-col gap-2">
          <p className="eyebrow">Según tu ánimo</p>
          <h1 className="font-display text-5xl leading-none tracking-wide text-fg sm:text-6xl">{label}</h1>
          {description && <p className="text-fg-secondary">{description}</p>}
        </div>
      </header>

      <nav aria-label="Otros estados de ánimo" className="-mt-4 flex flex-wrap gap-2">
        {MOODS.filter((m) => m.slug !== slug).map((m) => {
          const MoodIcon = m.icon;
          return (
            <Link
              key={m.slug}
              to={`/mood/${m.slug}`}
              className="flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-semibold text-fg-secondary backdrop-blur-md transition hover:border-focus hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
            >
              <MoodIcon className={`size-4 ${m.text}`} aria-hidden />
              {m.label}
            </Link>
          );
        })}
      </nav>

      {mood.isPending ? (
        <MovieGridSkeleton label={`Buscando películas: ${label}…`} />
      ) : mood.isError ? (
        <ErrorState title="No pudimos cargar estas películas" message={getErrorMessage(mood.error)} onRetry={() => mood.refetch()} />
      ) : mood.data.movies.length === 0 ? (
        <EmptyState icon={SearchX} title="Sin películas por ahora" description="Probá con otro estado de ánimo." />
      ) : (
        <div className={`flex flex-col gap-6 transition-opacity ${mood.isPlaceholderData ? "opacity-60" : ""}`}>
          {mood.data.degraded && (
            <Card variant="solid" className="flex items-start gap-3 p-4 text-sm text-fg-secondary">
              <Info className="mt-0.5 size-4 shrink-0 text-violet-soft" aria-hidden />
              TMDB no responde en este momento: te mostramos películas de nuestro catálogo.
            </Card>
          )}
          <MovieGrid movies={mood.data.movies} />
          <Pagination
            page={page}
            totalPages={mood.data.hasMore ? page + 1 : page}
            onPageChange={(next) => {
              setParams(next > 1 ? { page: String(next) } : {});
              window.scrollTo?.({ top: 0 });
            }}
          />
        </div>
      )}
    </PageContainer>
  );
}
