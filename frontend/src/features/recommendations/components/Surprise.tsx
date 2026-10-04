import { useMutation } from "@tanstack/react-query";
import { Dices, ExternalLink, Orbit, Search, Sparkles } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";

import { ApiError, getErrorMessage } from "@/api/client";
import { ClapperMark } from "@/components/brand/Logo";
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

// The tickets turn over one after the other, once the dialog has settled.
const FIRST_FLIP_MS = 450;
const FLIP_STEP_MS = 420;

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Surprise mode (EPIC 4): owns the dialog, so any "Sorprendeme" (menu, Descubrir) can open
 * it, even from the mobile menu that closes right away. Each opening deals three new
 * movies; "Otras 3" never brings back the ones on screen.
 */
export function SurpriseProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const surprise = useMutation({ mutationFn: (exclude: number[]) => getSurprise(exclude) });
  const { mutate } = surprise;

  const openSurprise = useCallback(() => {
    setOpen(true);
    mutate([]);
  }, [mutate]);
  const value = useMemo(() => ({ openSurprise }), [openSurprise]);

  return (
    <SurpriseContext.Provider value={value}>
      {children}
      <SurpriseDialog open={open} onClose={() => setOpen(false)} state={surprise} />
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
  data: Surprise[] | undefined;
  variables: number[] | undefined;
  mutate: (exclude: number[]) => void;
}

function SurpriseDialog({ open, onClose, state }: { open: boolean; onClose: () => void; state: SurpriseState }) {
  const titleId = useId();
  const movies = state.data;

  let body;
  if (state.isPending) {
    body = (
      <div className="px-6 py-10">
        <h2 id={titleId} className="sr-only">
          Buscando sorpresas
        </h2>
        <StarsLoadingState label="Repartiendo tres entradas entre tus estrellas…" />
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
            onRetry={() => state.mutate(state.variables ?? [])}
          />
        )}
      </div>
    );
  } else if (movies) {
    body = (
      <div className="relative flex flex-col gap-6 p-5 pt-10 sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-violet/30 blur-[90px]" />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 -right-20 size-72 rounded-full bg-blue/25 blur-[90px]" />

        <header className="relative flex flex-col gap-2 pr-8">
          <p className="eyebrow flex items-center gap-2">
            <Sparkles className="size-3.5 text-violet-soft" aria-hidden />
            Tu sorpresa
          </p>
          <h2 id={titleId} className="font-display text-4xl leading-none tracking-wide text-fg sm:text-5xl">
            Elegí tu función
          </h2>
          <p className="text-sm text-fg-secondary">
            {movies.length === 1 ? "Una entrada" : `${movies.length} entradas`}, películas distintas entre sí. Tocá la que más
            te tiente.
          </p>
        </header>

        {/* Keyed by the batch: a new hand starts face down again. */}
        <SurpriseHand key={movies.map((m) => m.id).join("-")} movies={movies} onClose={onClose} />

        <div className="relative flex flex-wrap items-center justify-center gap-3 border-t border-line pt-5 sm:justify-between">
          <p className="text-xs text-fg-muted">Nunca repetimos las que ya viste, rechazaste o te mostramos recién.</p>
          <Button variant="secondary" onClick={() => state.mutate(movies.map((m) => m.id))}>
            <Dices className="size-4" aria-hidden />
            Otras 3
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} size="lg">
      {body}
    </Modal>
  );
}

/** The dealt tickets: they turn over one by one (all at once with reduced motion). */
function SurpriseHand({ movies, onClose }: { movies: Surprise[]; onClose: () => void }) {
  const [revealed, setRevealed] = useState(() => (prefersReducedMotion() ? movies.length : 0));
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    if (revealed >= movies.length) return;
    const timer = window.setTimeout(() => setRevealed((n) => n + 1), revealed === 0 ? FIRST_FLIP_MS : FLIP_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [revealed, movies.length]);

  const allRevealed = revealed >= movies.length;
  return (
    <>
      <ul className="relative grid gap-4 sm:grid-cols-3 sm:gap-5">
        {movies.map((movie, index) => (
          <li
            key={movie.id}
            className="animate-ticket-in"
            style={{ animationDelay: `${index * 90}ms` }}
          >
            <SurpriseTicket
              movie={movie}
              number={index + 1}
              revealed={index < revealed}
              selected={selected === movie.id}
              dimmed={selected !== null && selected !== movie.id}
              onSelect={() => setSelected((current) => (current === movie.id ? null : movie.id))}
              onClose={onClose}
            />
          </li>
        ))}
      </ul>
      <p role="status" className="sr-only">
        {allRevealed ? `Tus sorpresas: ${movies.map((m) => m.title).join(", ")}.` : ""}
      </p>
    </>
  );
}

interface SurpriseTicketProps {
  movie: Surprise;
  number: number;
  revealed: boolean;
  selected: boolean;
  dimmed: boolean;
  onSelect: () => void;
  onClose: () => void;
}

/**
 * A card that starts face down as a cinema ticket (logo, starry pattern, perforation) and
 * turns over in 3D to show the movie. The front is `inert` until it is revealed.
 */
function SurpriseTicket({ movie, number, revealed, selected, dimmed, onSelect, onClose }: SurpriseTicketProps) {
  const rating = formatRating(movie.voteAverage);
  const whyId = useId();
  return (
    <div className={`h-full perspective-distant transition-opacity duration-300 ${dimmed ? "opacity-55 hover:opacity-90" : ""}`}>
      <div
        className={`relative grid h-full transition-transform duration-700 ease-out transform-3d motion-reduce:transition-none ${
          revealed ? "rotate-y-0" : "rotate-y-180"
        }`}
      >
        {/* Front: the movie. */}
        <article
          inert={!revealed}
          aria-hidden={!revealed}
          className={`col-start-1 row-start-1 flex flex-col gap-3 rounded-card border bg-raised p-3 backface-hidden transition-[border-color,box-shadow] sm:p-4 ${
            selected ? "border-violet-light shadow-halo" : "border-line-strong"
          }`}
        >
          <button
            type="button"
            aria-pressed={selected}
            aria-describedby={whyId}
            onClick={onSelect}
            className="group flex gap-3 rounded-control text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus sm:flex-col sm:items-center sm:text-center"
          >
            <span
              className={`w-24 shrink-0 overflow-hidden rounded-poster border-2 shadow-poster transition sm:w-36 lg:w-40 ${
                selected ? "border-violet-light" : "border-transparent group-hover:border-focus"
              }`}
            >
              <PosterImage src={movie.posterUrl} alt="" title={movie.title} className="w-full" />
            </span>
            <span className="flex min-w-0 flex-col gap-1.5 sm:items-center">
              <span className="font-display text-2xl leading-none tracking-wide text-fg">{movie.title}</span>
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-fg-secondary sm:justify-center">
                {movie.releaseYear && <span>{movie.releaseYear}</span>}
                {rating && (
                  <span className="flex items-center gap-1 font-bold text-gold" aria-label={`Puntuación ${rating}`}>
                    <span aria-hidden>★</span>
                    {rating}
                  </span>
                )}
                <span className="rounded-full border border-violet-light/40 bg-violet/15 px-2 py-0.5 font-bold text-violet-soft">
                  {BUCKET_LABELS[movie.popularityBucket]}
                </span>
              </span>
            </span>
          </button>

          <div id={whyId} className="rounded-control border border-line bg-deep/60 px-3 py-2 text-left">
            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[2px] text-label">¿Por qué?</p>
            <p className={`text-xs leading-relaxed text-fg-secondary ${selected ? "" : "line-clamp-3"}`}>{movie.explanation}</p>
          </div>

          <div className="mt-auto">
            {selected ? (
              <div className="flex animate-fade-up flex-col gap-2">
                <Link to={`/movies/${movie.id}`} onClick={onClose} className={buttonClasses({ size: "sm" })}>
                  <ExternalLink className="size-4" aria-hidden />
                  Ver ficha
                </Link>
                <Link to={`/universe/${movie.id}`} onClick={onClose} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                  <Orbit className="size-4" aria-hidden />
                  Explorar universo
                </Link>
              </div>
            ) : (
              <p className="py-1 text-center text-xs font-semibold text-violet-soft" aria-hidden>
                Tocá para elegirla
              </p>
            )}
          </div>
        </article>

        {/* Back: the ticket. Same grid cell as the front, turned around. */}
        <div
          aria-hidden
          className="relative col-start-1 row-start-1 flex flex-col items-center justify-center gap-3 overflow-hidden rounded-card border border-line-strong bg-ticket p-4 rotate-y-180 backface-hidden"
        >
          <span className="absolute inset-2 rounded-poster border border-dashed border-violet-light/35" />
          <span className="eyebrow relative">Entrada · Función {number}</span>
          <span className="relative flex size-20 items-center justify-center rounded-full border border-violet-light/40 bg-deep/70 shadow-halo sm:size-24">
            <ClapperMark className="size-12 sm:size-14" />
          </span>
          <span className="relative font-display text-3xl leading-none tracking-[3px] text-fg">
            MOVIE<span className="text-violet-light">VERSE</span>
          </span>
          {/* Perforation with a notch on each side. */}
          <span className="relative mt-2 w-full border-t border-dashed border-line-strong" />
          <span className="absolute -left-3 bottom-[22%] size-6 rounded-full border border-line-strong bg-base" />
          <span className="absolute -right-3 bottom-[22%] size-6 rounded-full border border-line-strong bg-base" />
          <span className="relative text-[10px] font-bold uppercase tracking-[4px] text-fg-muted">Admite uno · Nº 00{number}</span>
        </div>
      </div>
    </div>
  );
}
