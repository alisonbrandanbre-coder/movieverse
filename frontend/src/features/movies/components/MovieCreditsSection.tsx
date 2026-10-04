import { UserRound } from "lucide-react";

import { getErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import type { CastMember } from "@/types/movie";

import { useMovieCredits } from "../hooks";

function PersonAvatar({ name, src }: { name: string; src: string | null }) {
  if (!src) {
    return (
      <div className="flex size-20 items-center justify-center rounded-full border border-line bg-raised text-fg-muted">
        <UserRound className="size-8" aria-hidden />
      </div>
    );
  }
  return <img src={src} alt={name} loading="lazy" className="size-20 rounded-full object-cover ring-2 ring-violet-light/40" />;
}

function CastList({ cast }: { cast: CastMember[] }) {
  return (
    <ul className="-mx-4 flex snap-x gap-5 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
      {cast.map((member) => (
        <li key={member.id} className="flex w-28 shrink-0 snap-start flex-col items-center gap-2 text-center">
          <PersonAvatar name={member.name} src={member.profileUrl} />
          <div>
            <p className="text-sm font-bold text-fg">{member.name}</p>
            {member.character && <p className="text-xs text-fg-muted">{member.character}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function MovieCreditsSection({ movieId }: { movieId: number }) {
  const { data, isPending, isError, error, refetch } = useMovieCredits(movieId);

  if (isPending) return <LoadingState label="Cargando reparto…" />;
  if (isError) {
    return (
      <Card role="alert" className="flex flex-col items-start gap-3 p-5">
        <p className="text-sm text-fg-secondary">{getErrorMessage(error, "No pudimos cargar el reparto.")}</p>
        <Button variant="secondary" onClick={() => refetch()}>
          Reintentar
        </Button>
      </Card>
    );
  }

  const directorNames = data.directors.map((d) => d.name).join(", ");

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="director-heading">
        <h2 id="director-heading" className="eyebrow mb-2">
          {data.directors.length > 1 ? "Dirección" : "Director"}
        </h2>
        <p className="text-lg font-semibold text-fg">{directorNames || "Sin información de dirección."}</p>
      </section>
      <section aria-labelledby="cast-heading">
        <h2 id="cast-heading" className="mb-4 font-display text-3xl tracking-wide text-fg">
          Reparto principal
        </h2>
        {data.cast.length > 0 ? <CastList cast={data.cast} /> : <p className="text-fg-muted">Sin información de reparto.</p>}
      </section>
    </div>
  );
}
