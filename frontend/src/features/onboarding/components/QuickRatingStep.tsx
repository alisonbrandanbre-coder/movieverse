import { ThumbsDown, ThumbsUp } from "lucide-react";

import { getErrorMessage } from "@/api/client";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { ToggleButton } from "@/components/ui/ToggleButton";
import { PosterImage } from "@/features/movies/components/PosterImage";
import { useOnboardingSample } from "@/features/preferences/hooks";
import type { Reaction } from "@/types/preferences";

interface QuickRatingStepProps {
  genreIds: number[];
  avoidIds: number[];
  ratings: Record<number, Reaction>;
  onRate: (movieId: number, reaction: Reaction | null) => void;
}

/** Step 6: like / not interested on well-known titles. Optional: every title can be skipped. */
export function QuickRatingStep({ genreIds, avoidIds, ratings, onRate }: QuickRatingStepProps) {
  const sample = useOnboardingSample(genreIds, avoidIds, true);

  if (sample.isPending) return <LoadingState label="Buscando títulos para valorar…" />;
  if (sample.isError) {
    return (
      <ErrorState
        title="No pudimos cargar los títulos"
        message={`${getErrorMessage(sample.error)} Podés terminar igual y valorar películas más tarde.`}
        onRetry={() => sample.refetch()}
      />
    );
  }
  if (sample.data.length === 0) {
    return (
      <EmptyState
        title="No hay títulos para valorar"
        description="Podés terminar igual: vas a poder marcar películas desde su ficha."
      />
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4">
      {sample.data.map((movie) => {
        const reaction = ratings[movie.id] ?? null;
        const toggle = (value: Reaction) => onRate(movie.id, reaction === value ? null : value);
        return (
          <li key={movie.id} className="flex flex-col gap-2">
            <PosterImage
              src={movie.posterUrl}
              alt={`Póster de ${movie.title}`}
              title={movie.title}
              className={`w-full rounded-poster border shadow-poster transition ${
                reaction === "LIKE" ? "border-violet-light" : reaction === "DISLIKE" ? "border-danger-strong opacity-60" : "border-line"
              }`}
            />
            <p className="line-clamp-1 text-sm font-bold text-fg" title={movie.title}>
              {movie.title}
              {movie.releaseYear && <span className="ml-1 font-normal text-fg-muted">({movie.releaseYear})</span>}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <ToggleButton
                size="sm"
                icon={ThumbsUp}
                aria-label={`Me gusta ${movie.title}`}
                pressed={reaction === "LIKE"}
                onClick={() => toggle("LIKE")}
              />
              <ToggleButton
                size="sm"
                tone="danger"
                icon={ThumbsDown}
                aria-label={`No me interesa ${movie.title}`}
                pressed={reaction === "DISLIKE"}
                onClick={() => toggle("DISLIKE")}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
