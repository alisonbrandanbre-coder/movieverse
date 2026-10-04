import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Orbit } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router";

import { ApiError, getErrorMessage } from "@/api/client";
import { buttonClasses } from "@/components/ui/buttonClasses";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { StarsLoadingState } from "@/components/ui/StarsLoadingState";
import { getNeighborhood, graphKeys } from "@/features/universe/api";
import { UniverseMap } from "@/features/universe/components/UniverseMap";

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex size-full items-center justify-center px-4">{children}</div>;
}

export function UniversePage() {
  const params = useParams();
  const movieId = Number(params.movieId);
  const isValidId = Number.isInteger(movieId) && movieId > 0;
  const neighborhood = useQuery({
    queryKey: graphKeys.movie(movieId),
    queryFn: ({ signal }) => getNeighborhood(movieId, signal),
    enabled: isValidId,
    staleTime: 10 * 60_000,
  });

  const notFound = (
    <Centered>
      <EmptyState title="Película no encontrada" description="No podemos trazar el universo de una película que no existe.">
        <Link to="/search" className={buttonClasses()}>
          Buscar películas
        </Link>
      </EmptyState>
    </Centered>
  );

  if (!isValidId) return notFound;
  if (neighborhood.isPending) {
    return (
      <Centered>
        <StarsLoadingState label="Trazando el universo…" />
      </Centered>
    );
  }
  if (neighborhood.isError) {
    if (neighborhood.error instanceof ApiError && neighborhood.error.status === 404) return notFound;
    return (
      <Centered>
        <ErrorState
          title="No pudimos trazar el mapa"
          message={getErrorMessage(neighborhood.error)}
          onRetry={() => neighborhood.refetch()}
        />
      </Centered>
    );
  }

  const { data } = neighborhood;
  if (data.edges.length === 0) {
    const center = data.nodes.find((n) => n.id === data.center);
    return (
      <Centered>
        <Card className="px-6">
          <EmptyState
            icon={Orbit}
            title="Todavía no hay conexiones"
            description={`No encontramos películas conectadas con ${center?.title ?? "esta película"}. Probá con otra.`}
          >
            <Link to={`/movies/${movieId}`} className={buttonClasses({ variant: "secondary" })}>
              <ArrowLeft className="size-4" aria-hidden />
              Volver a la ficha
            </Link>
          </EmptyState>
        </Card>
      </Centered>
    );
  }

  return (
    <div className="size-full">
      <h1 className="sr-only">Universo de {data.nodes.find((n) => n.id === data.center)?.title}</h1>
      <UniverseMap key={movieId} initial={data} />
    </div>
  );
}
