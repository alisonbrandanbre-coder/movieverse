import { Crosshair, ExternalLink, Library, LoaderCircle, Orbit, X } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/Button";
import { buttonClasses } from "@/components/ui/buttonClasses";
import { PosterImage } from "@/features/movies/components/PosterImage";
import type { GraphConnection, GraphMovie } from "@/types/graph";

import { CONNECTION_STYLES } from "../connectionStyles";

interface NodePanelProps {
  movie: GraphMovie;
  connections: { connection: GraphConnection; other: GraphMovie | undefined }[];
  isRoot: boolean;
  isExpanded: boolean;
  expanding: boolean;
  atLimit: boolean;
  onExpand: () => void;
  onCenter: () => void;
  onClose: () => void;
  /** Center only, when part of its saga is not on the map yet. */
  saga?: { total: number; loading: boolean; onShow: () => void };
}

/**
 * Selected movie: poster, short synopsis, score, why it is connected and the next steps.
 * Side panel on desktop, bottom sheet on mobile.
 */
export function NodePanel({
  movie,
  connections,
  isRoot,
  isExpanded,
  expanding,
  atLimit,
  onExpand,
  onCenter,
  onClose,
  saga,
}: NodePanelProps) {
  return (
    <aside
      aria-label={`Detalle de ${movie.title}`}
      className="absolute inset-x-0 bottom-0 z-20 flex max-h-[62%] animate-fade-up flex-col overflow-hidden rounded-t-card border border-line-strong bg-base/95 shadow-card backdrop-blur-lg md:top-[4.5rem] md:bottom-4 md:right-4 md:left-auto md:max-h-none md:w-96 md:rounded-card"
    >
      <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-strong md:hidden" aria-hidden />
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <p className="eyebrow">{isRoot ? "Punto de partida" : "Película conectada"}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar panel"
          className="-mr-1 -mt-1 rounded-control p-1.5 text-fg-secondary hover:bg-violet/15 hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pb-5 pt-3">
        <div className="flex gap-4">
          <PosterImage
            src={movie.posterUrl}
            alt={`Póster de ${movie.title}`}
            title={movie.title}
            className="w-24 shrink-0 rounded-poster border border-line-strong shadow-poster md:w-28"
          />
          <div className="flex min-w-0 flex-col gap-1.5">
            <h2 className="font-display text-3xl leading-none tracking-wide text-fg">{movie.title}</h2>
            <p className="text-sm text-fg-muted">{movie.year ?? "Sin fecha"}</p>
            {movie.score !== null && movie.score > 0 && (
              <p className="flex items-baseline gap-1" aria-label={`Puntuación ${movie.score.toFixed(1)} de 10`}>
                <span aria-hidden className="text-gold">
                  ★
                </span>
                <strong className="text-lg font-extrabold text-gold">{movie.score.toFixed(1)}</strong>
              </p>
            )}
          </div>
        </div>

        {movie.overview && <p className="text-sm leading-relaxed text-fg-secondary">{movie.overview}</p>}

        {connections.length > 0 && (
          <section aria-labelledby="panel-connections" className="flex flex-col gap-2">
            <h3 id="panel-connections" className="eyebrow text-[11px] tracking-[3px]">
              {connections.length === 1 ? "Conexión" : "Conexiones"}
            </h3>
            <ul className="flex flex-col gap-2">
              {connections.map(({ connection, other }) => (
                <li key={`${connection.source}-${connection.target}`} className="rounded-control border border-line bg-raised/60 px-3 py-2.5">
                  {other && <p className="mb-1 text-xs text-fg-muted">Con {other.title}</p>}
                  <ul className="flex flex-col gap-1">
                    {connection.reasons.map((reason) => {
                      const { icon: Icon, text, label } = CONNECTION_STYLES[reason.type];
                      return (
                        <li key={reason.type} className="flex items-start gap-2 text-sm text-fg">
                          <Icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${text}`} />
                          <span>
                            <span className="sr-only">{label}: </span>
                            {reason.label}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {saga && (
        <div className="shrink-0 border-t border-line px-5 pt-4">
          <Button variant="secondary" className="w-full" onClick={saga.onShow} disabled={saga.loading || atLimit}>
            {saga.loading ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <Library className="size-4 text-coral" aria-hidden />
            )}
            {saga.loading ? "Sumando la saga…" : `Ver saga completa (${saga.total})`}
          </Button>
        </div>
      )}
      <div className={`flex shrink-0 flex-col gap-2 px-5 py-4 sm:flex-row ${saga ? "" : "border-t border-line"}`}>
        {isExpanded ? (
          <Button className="flex-1" onClick={onCenter}>
            <Crosshair className="size-4" aria-hidden />
            Centrar acá
          </Button>
        ) : (
          <Button className="flex-1" onClick={onExpand} disabled={expanding || atLimit}>
            {expanding ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
            ) : (
              <Orbit className="size-4" aria-hidden />
            )}
            {expanding ? "Expandiendo…" : "Expandir desde acá"}
          </Button>
        )}
        <Link to={`/movies/${movie.id}`} className={`${buttonClasses({ variant: "secondary" })} flex-1`}>
          <ExternalLink className="size-4" aria-hidden />
          Ver ficha
        </Link>
      </div>
    </aside>
  );
}
