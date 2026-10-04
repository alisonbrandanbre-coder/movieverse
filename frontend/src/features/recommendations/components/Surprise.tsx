import { useMutation } from "@tanstack/react-query";
import { Dices, ExternalLink, Orbit, Search, Sparkles } from "lucide-react";
import { useCallback, useId, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";

import { ApiError, getErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { buttonClasses } from "@/components/ui/buttonClasses";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Modal } from "@/components/ui/Modal";
import { StarsLoadingState } from "@/components/ui/StarsLoadingState";
import { PosterImage } from "@/features/movies/components/PosterImage";
import type { PopularityBucket, Surprise } from "@/types/recommendations";
import { formatRating } from "@/utils/format";

import { getSurprise } from "../api";
import { SurpriseContext, useSurprise } from "../SurpriseContext";

const BUCKET_LABELS: Record<PopularityBucket, string> = {
  HIDDEN: "Joya poco conocida",
  MEDIUM: "Para descubrir",
  POPULAR: "Popular",
  VERY_POPULAR: "Muy popular",
};

// Decorative sparkles around the poster (they twinkle; still with reduced motion).
// Gold stays for the rating only (design system).
const SPARKLES = [
  { className: "left-[6%] top-[12%] size-3", delay: "0s" },
  { className: "right-[8%] top-[20%] size-2", delay: "-1.2s" },
  { className: "left-[14%] bottom-[18%] size-2", delay: "-2.1s" },
  { className: "right-[16%] bottom-[10%] size-3", delay: "-0.6s" },
];

/**
 * Surprise mode (EPIC 4): owns the dialog, so any "Sorprendeme" (menu, Descubrir) can open
 * it, even from the mobile menu that closes right away. Each opening draws a new movie;
 * "Otra" never brings back the one on screen.
 */
export function SurpriseProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const surprise = useMutation({ mutationFn: (exclude?: number) => getSurprise(exclude) });
  const { mutate } = surprise;

  const openSurprise = useCallback(() => {
    setOpen(true);
    mutate(undefined);
  }, [mutate]);
  const value = useMemo(() => ({ openSurprise }), [openSurprise]);

  return (
    <SurpriseContext.Provider value={value}>
      {children}
      <SurpriseDialog open={open} onClose={() => setOpen(false)} state={surprise} onAnother={(current) => mutate(current)} />
    </SurpriseContext.Provider>
  );
}

/** "Sorprendeme": a secondary button, or a menu item with `variant="nav"`. */
export function SurpriseButton({
  variant = "button",
  className = "",
  onOpen,
}: {
  variant?: "button" | "nav";
  className?: string;
  /** Called right before the dialog opens (e.g. to close the mobile menu). */
  onOpen?: () => void;
}) {
  const { openSurprise } = useSurprise();
  function start() {
    onOpen?.();
    openSurprise();
  }

  return variant === "nav" ? (
    <button
      type="button"
      onClick={start}
      className={`flex items-center gap-2 rounded-control px-3.5 py-2 text-sm font-semibold text-fg-secondary transition-colors hover:bg-violet/10 hover:text-fg focus-visible:outline-2 focus-visible:outline-focus ${className}`}
    >
      <Dices className="size-4 text-violet-soft" aria-hidden />
      Sorprendeme
    </button>
  ) : (
    <Button onClick={start} className={className}>
      <Dices className="size-4 text-violet-soft" aria-hidden />
      Sorprendeme
    </Button>
  );
}

interface SurpriseState {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  data: Surprise | undefined;
  variables: number | undefined;
  mutate: (exclude?: number) => void;
}

function SurpriseDialog({
  open,
  onClose,
  state,
  onAnother,
}: {
  open: boolean;
  onClose: () => void;
  state: SurpriseState;
  onAnother: (current: number) => void;
}) {
  const titleId = useId();
  const movie = state.data;

  let body;
  if (state.isPending) {
    body = (
      <div className="px-6 py-10">
        <h2 id={titleId} className="sr-only">
          Buscando una sorpresa
        </h2>
        <StarsLoadingState label="Buscando una sorpresa entre tus estrellas…" />
      </div>
    );
  } else if (state.isError) {
    const empty = state.error instanceof ApiError && state.error.code === "NO_SURPRISE";
    body = (
      <div className="px-6">
        <h2 id={titleId} className="sr-only">
          Modo sorpresa
        </h2>
        {empty ? (
          <EmptyState icon={Sparkles} title="Todavía no hay sorpresas" description={getErrorMessage(state.error)}>
            <Link to="/search" onClick={onClose} className={buttonClasses()}>
              <Search className="size-4" aria-hidden />
              Buscar películas
            </Link>
          </EmptyState>
        ) : (
          <ErrorState
            title="No pudimos sorprenderte"
            message={getErrorMessage(state.error)}
            onRetry={() => state.mutate(state.variables)}
          />
        )}
      </div>
    );
  } else if (movie) {
    const rating = formatRating(movie.voteAverage);
    body = (
      <div className="relative flex flex-col items-center gap-6 p-6 pt-10 sm:flex-row sm:items-stretch sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-violet/30 blur-[90px]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 -right-20 size-72 rounded-full bg-blue/25 blur-[90px]" />

        <div className="relative w-44 shrink-0 sm:w-52">
          {SPARKLES.map((s) => (
            <Sparkles
              key={s.delay}
              aria-hidden
              className={`absolute z-10 animate-twinkle text-violet-soft motion-reduce:animate-none ${s.className}`}
              style={{ animationDelay: s.delay }}
            />
          ))}
          <div key={movie.id} className="animate-pop overflow-hidden rounded-poster border-2 border-violet-light shadow-halo">
            <PosterImage src={movie.posterUrl} alt={`Póster de ${movie.title}`} title={movie.title} className="w-full" />
          </div>
        </div>

        <div className="relative flex min-w-0 flex-1 flex-col gap-3 text-center sm:text-left">
          <p className="eyebrow flex items-center justify-center gap-2 sm:justify-start">
            <Sparkles className="size-3.5 text-violet-soft" aria-hidden />
            Tu sorpresa
          </p>
          <h2 id={titleId} className="font-display text-4xl leading-none tracking-wide text-fg sm:text-5xl">
            {movie.title}
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-fg-secondary sm:justify-start">
            {movie.releaseYear && <span>{movie.releaseYear}</span>}
            {rating && (
              <span className="flex items-center gap-1 font-bold text-gold" aria-label={`Puntuación ${rating}`}>
                <span aria-hidden>★</span>
                {rating}
              </span>
            )}
            <span className="rounded-full border border-violet-light/40 bg-violet/15 px-2.5 py-0.5 text-xs font-bold text-violet-soft">
              {BUCKET_LABELS[movie.popularityBucket]}
            </span>
          </div>
          <div className="rounded-control border border-line bg-surface px-4 py-3 text-left">
            <p className="mb-1 text-xs font-bold uppercase tracking-[2px] text-label">¿Por qué?</p>
            <p className="text-sm leading-relaxed text-fg-secondary">{movie.explanation}</p>
          </div>
          <div className="mt-auto flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap">
            <Link to={`/movies/${movie.id}`} onClick={onClose} className={buttonClasses()}>
              <ExternalLink className="size-4" aria-hidden />
              Ver ficha
            </Link>
            <Link to={`/universe/${movie.id}`} onClick={onClose} className={buttonClasses({ variant: "secondary" })}>
              <Orbit className="size-4" aria-hidden />
              Explorar universo
            </Link>
            <Button variant="ghost" onClick={() => onAnother(movie.id)}>
              <Dices className="size-4" aria-hidden />
              Otra
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId}>
      {body}
    </Modal>
  );
}
