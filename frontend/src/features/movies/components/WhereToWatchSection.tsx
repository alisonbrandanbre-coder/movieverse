import { ExternalLink } from "lucide-react";

import { getErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import type { WatchProvider } from "@/types/movie";

import { useMovieWatchProviders } from "../hooks";
import { ProviderLogo } from "./ProviderLogo";

function ProviderRow({ title, providers }: { title: string; providers: WatchProvider[] }) {
  if (providers.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <h3 className="eyebrow">{title}</h3>
      <ul className="flex flex-wrap gap-4">
        {providers.map((provider) => (
          <li key={provider.tmdbId} className="flex w-20 flex-col items-center gap-2 text-center">
            <ProviderLogo provider={provider} />
            <span className="text-xs font-semibold text-fg-secondary">{provider.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Dónde verla" in the movie detail: platforms of the backend's region (Argentina). */
export function WhereToWatchSection({ movieId }: { movieId: number }) {
  const { data, isPending, isError, error, refetch } = useMovieWatchProviders(movieId);

  let body;
  if (isPending) {
    body = (
      <div className="flex gap-4" aria-label="Cargando plataformas…" role="status">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="size-12 rounded-control" />
        ))}
      </div>
    );
  } else if (isError) {
    body = (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p className="text-sm text-fg-secondary">{getErrorMessage(error, "No pudimos cargar dónde verla.")}</p>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          Reintentar
        </Button>
      </div>
    );
  } else if (data.streaming.length + data.rent.length + data.buy.length === 0) {
    body = <p className="text-sm text-fg-secondary">Por ahora no está disponible en plataformas de Argentina.</p>;
  } else {
    body = (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:flex-wrap sm:gap-10">
          <ProviderRow title="En streaming" providers={data.streaming} />
          <ProviderRow title="Alquiler" providers={data.rent} />
          <ProviderRow title="Compra" providers={data.buy} />
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
          Datos de JustWatch vía TMDB.
          {data.link && (
            <a
              href={data.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-violet-soft hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
            >
              Ver todas las opciones
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
        </p>
      </div>
    );
  }

  return (
    <section aria-labelledby="where-to-watch-heading">
      <Card className="flex flex-col gap-5 p-5 sm:p-6">
        <h2 id="where-to-watch-heading" className="font-display text-3xl leading-none tracking-wide text-fg">
          Dónde verla
        </h2>
        {body}
      </Card>
    </section>
  );
}
