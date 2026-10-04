import { createContext, useContext } from "react";

import type { ChipSpot } from "./graph";

export interface UniverseContextValue {
  rootId: number;
  focusId: number;
  selectedId: number | null;
  hoveredEdgeId: string | null;
  /** The movie under the pointer (or, without one, the selected movie): its edges stand out. */
  spotlightId: number | null;
  /** The spotlight movie and those directly connected to it (the rest is dimmed). */
  highlighted: Set<number> | null;
  /** Movies whose every connection is hidden by the legend filter. */
  orphans: Set<number>;
  /** Where each edge's chip goes and whether it shows without hovering. */
  chips: Map<string, ChipSpot>;
  select: (movieId: number) => void;
  hoverNode: (movieId: number | null) => void;
  hoverEdge: (edgeId: string | null) => void;
}

export const UniverseContext = createContext<UniverseContextValue | null>(null);

export function useUniverse(): UniverseContextValue {
  const value = useContext(UniverseContext);
  if (!value) throw new Error("useUniverse must be used inside <UniverseMap>");
  return value;
}
