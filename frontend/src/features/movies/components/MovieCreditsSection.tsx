import { UserRound } from "lucide-react";

import { getErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import type { CastMember } from "@/types/movie";

import { useMovieCredits } from "../hooks";

function PersonAvatar({ name, src }: { name: string; src: string | null }) {
  if (!src) {
    return (
      <div className="flex size-16 items-center justify-center rounded-full bg-slate-800 text-slate-500">
        <UserRound className="size-7" aria-hidden />
      </div>
    );
  }
  return <img src={src} alt={name} loading="lazy" className="size-16 rounded-full object-cover" />;
}

function CastList({ cast }: { cast: CastMember[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {cast.map((member) => (
        <li key={member.id} className="flex flex-col items-center gap-2 text-center">
          <PersonAvatar name={member.name} src={member.profileUrl} />
          <div>
            <p className="text-sm font-medium text-slate-100">{member.name}</p>
            {member.character && <p className="text-xs text-slate-400">{member.character}</p>}
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
      <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-slate-800 p-4">
        <p className="text-sm text-slate-400">{getErrorMessage(error, "No pudimos cargar el reparto.")}</p>
        <Button variant="secondary" onClick={() => refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  const directorNames = data.directors.map((d) => d.name).join(", ");

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="director-heading">
        <h2 id="director-heading" className="mb-2 text-lg font-semibold text-white">
          {data.directors.length > 1 ? "Dirección" : "Director"}
        </h2>
        <p className="text-slate-300">{directorNames || "Sin información de dirección."}</p>
      </section>
      <section aria-labelledby="cast-heading">
        <h2 id="cast-heading" className="mb-4 text-lg font-semibold text-white">
          Reparto principal
        </h2>
        {data.cast.length > 0 ? (
          <CastList cast={data.cast} />
        ) : (
          <p className="text-slate-400">Sin información de reparto.</p>
        )}
      </section>
    </div>
  );
}
