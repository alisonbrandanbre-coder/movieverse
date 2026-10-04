import { createContext, useContext } from "react";

export interface SurpriseContextValue {
  /** Opens the surprise dialog with a new draw. */
  openSurprise: () => void;
}

export const SurpriseContext = createContext<SurpriseContextValue | null>(null);

export function useSurprise(): SurpriseContextValue {
  const value = useContext(SurpriseContext);
  if (!value) throw new Error("useSurprise must be used inside <SurpriseProvider>");
  return value;
}
