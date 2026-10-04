import { Bookmark, Eye, Heart, Orbit, ThumbsDown, ThumbsUp, type LucideIcon } from "lucide-react";
import { useState } from "react";

import { getErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { ToggleButton } from "@/components/ui/ToggleButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { buttonClasses } from "@/components/ui/buttonClasses";
import { useMovieInteractions, useToggleInteraction } from "@/features/interactions/hooks";
import type { InteractionType, MovieInteractionState } from "@/types/interactions";

interface ActionConfig {
  type: InteractionType;
  label: string;
  icon: LucideIcon;
  tone?: "accent" | "danger";
  /** `Eye` turns into a solid blob when filled. */
  fill?: boolean;
  on: string;
  off: string;
}

const ACTIONS: ActionConfig[] = [
  { type: "FAVORITE", label: "Favorita", icon: Heart, on: "Agregada a favoritas", off: "Quitada de favoritas" },
  { type: "WATCHLIST", label: "Pendiente", icon: Bookmark, on: "Agregada a pendientes", off: "Quitada de pendientes" },
  { type: "WATCHED", label: "Vista", icon: Eye, fill: false, on: "Marcada como vista", off: "Ya no figura como vista" },
  { type: "LIKE", label: "Me gusta", icon: ThumbsUp, on: "Te gusta esta película", off: "Quitaste el me gusta" },
  {
    type: "DISLIKE",
    label: "No me interesa",
    icon: ThumbsDown,
    tone: "danger",
    on: "No te la vamos a recomendar",
    off: "Quitaste el no me interesa",
  },
];

function isActive(state: MovieInteractionState, type: InteractionType): boolean {
  switch (type) {
    case "FAVORITE":
      return state.favorite;
    case "WATCHLIST":
      return state.watchlist;
    case "WATCHED":
      return state.watched;
    case "LIKE":
    case "DISLIKE":
      return state.reaction === type;
  }
}

/** Side effects applied by the backend (e.g. "Vista" also clears "Pendiente"), for the feedback text. */
function clearedLists(before: MovieInteractionState, after: MovieInteractionState, touched: InteractionType): string[] {
  const cleared: string[] = [];
  if (touched !== "FAVORITE" && before.favorite && !after.favorite) cleared.push("favoritas");
  if (touched !== "WATCHLIST" && before.watchlist && !after.watchlist) cleared.push("pendientes");
  return cleared;
}

const SOON = "Próximamente";

export function MovieActions({ movieId }: { movieId: number }) {
  const interactions = useMovieInteractions(movieId);
  const toggle = useToggleInteraction(movieId);
  const [feedback, setFeedback] = useState<{ text: string; error: boolean } | null>(null);

  function handleToggle(action: ActionConfig) {
    const before = interactions.data;
    if (!before || toggle.isPending) return;
    const active = !isActive(before, action.type);
    toggle.mutate(
      { type: action.type, active },
      {
        onSuccess: (after) => {
          const cleared = clearedLists(before, after, action.type);
          const extra = cleared.length > 0 ? ` y quitada de ${cleared.join(" y ")}` : "";
          setFeedback({ text: `${active ? action.on : action.off}${extra}.`, error: false });
        },
        onError: (error) => setFeedback({ text: getErrorMessage(error, "No pudimos guardar el cambio."), error: true }),
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Tooltip text={SOON} className="self-start">
        {(tooltipId) => (
          <button
            type="button"
            disabled
            aria-describedby={tooltipId}
            className={`${buttonClasses({ size: "lg" })} pointer-events-none px-9 text-lg`}
          >
            <Orbit className="size-5" aria-hidden />
            Explorar universo
          </button>
        )}
      </Tooltip>

      {interactions.isError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-danger">
          No pudimos cargar tus listas para esta película.
          <Button variant="secondary" size="sm" onClick={() => interactions.refetch()}>
            Reintentar
          </Button>
        </div>
      ) : (
        <div role="group" aria-label="Tus listas" aria-busy={interactions.isPending} className="flex flex-wrap gap-2">
          {ACTIONS.map((action) => (
            <ToggleButton
              key={action.type}
              icon={action.icon}
              label={action.label}
              tone={action.tone}
              fillWhenPressed={action.fill ?? true}
              size="sm"
              pressed={interactions.data ? isActive(interactions.data, action.type) : false}
              disabled={interactions.isPending}
              onClick={() => handleToggle(action)}
            />
          ))}
        </div>
      )}

      <p role="status" className={`min-h-5 text-sm ${feedback?.error ? "text-danger" : "text-violet-soft"}`}>
        {feedback?.text}
      </p>
    </div>
  );
}
