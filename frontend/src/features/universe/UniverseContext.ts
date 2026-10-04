import { createContext, useContext } from "react";

export interface UniverseContextValue {
  rootId: number;
  focusId: number;
  selectedId: number | null;
  hoveredEdgeId: string | null;
  /** Movies directly connected to the selected one (the rest is dimmed). */
  highlighted: Set<number> | null;
  select: (movieId: number) => void;
}

export const UniverseContext = createContext<UniverseContextValue | null>(null);

export function useUniverse(): UniverseContextValue {
  const value = useContext(UniverseContext);
  if (!value) throw new Error("useUniverse must be used inside <UniverseMap>");
  return value;
}
