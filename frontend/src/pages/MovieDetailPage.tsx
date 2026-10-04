import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router";

import { ApiError, getErrorMessage } from "@/api/client";
import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { MovieDetailSkeleton } from "@/components/ui/Skeleton";
import { MovieCreditsSection } from "@/features/movies/components/MovieCreditsSection";
import { MovieHero } from "@/features/movies/components/MovieHero";
import { WhereToWatchSection } from "@/features/movies/components/WhereToWatchSection";
import { useMovie } from "@/features/movies/hooks";

function MovieNotFound() {
  return <EmptyState title="Película no encontrada" description="La película que buscás no existe en MovieVerse." />;
}

export function MovieDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const movieId = Number(params.id);
  const isValidId = Number.isInteger(movieId) && movieId > 0;
  const movie = useMovie(movieId);

  if (!isValidId) return <MovieNotFound />;
  if (movie.isPending) return <MovieDetailSkeleton />;
  if (movie.isError) {
    if (movie.error instanceof ApiError && movie.error.status === 404) return <MovieNotFound />;
    return (
      <ErrorState
        title="No pudimos cargar la película"
        message={getErrorMessage(movie.error)}
        onRetry={() => movie.refetch()}
      />
    );
  }

  const { data } = movie;
  return (
    <article className="relative">
      <div className="absolute inset-x-0 top-5 z-10 mx-auto max-w-page px-4 sm:px-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 rounded-control border border-line bg-deep/60 px-3 py-1.5 text-sm font-semibold text-fg-secondary backdrop-blur-md hover:border-focus hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver
        </button>
      </div>
      <MovieHero key={data.id} movie={data} />
      <PageContainer className="flex flex-col gap-10">
        <WhereToWatchSection movieId={data.id} />
        <MovieCreditsSection movieId={data.id} />
      </PageContainer>
    </article>
  );
}
