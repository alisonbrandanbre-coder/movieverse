import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router";

import { ApiError, getErrorMessage } from "@/api/client";
import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { MovieCreditsSection } from "@/features/movies/components/MovieCreditsSection";
import { MovieHero } from "@/features/movies/components/MovieHero";
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

  const backButton = (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className="mx-auto mt-4 flex w-full max-w-6xl items-center gap-2 px-4 text-sm text-slate-400 hover:text-white"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Volver
    </button>
  );

  if (!isValidId) return <MovieNotFound />;
  if (movie.isPending) return <LoadingState label="Cargando película…" />;
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
    <article>
      {backButton}
      <MovieHero movie={data} />
      <PageContainer className="flex flex-col gap-10">
        <section aria-labelledby="overview-heading">
          <h2 id="overview-heading" className="mb-2 text-lg font-semibold text-white">
            Sinopsis
          </h2>
          <p className="max-w-3xl leading-relaxed text-slate-300">{data.overview || "Sin sinopsis disponible."}</p>
        </section>
        <MovieCreditsSection movieId={data.id} />
      </PageContainer>
    </article>
  );
}
