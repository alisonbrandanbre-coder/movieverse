import { Atom, Clapperboard, Drama, Library, Sparkles, Tag, type LucideIcon } from "lucide-react";

import type { ConnectionType } from "@/types/graph";

interface ConnectionStyle {
  label: string;
  icon: LucideIcon;
  /** CSS color from the design tokens (SVG strokes cannot use Tailwind classes). */
  color: string;
  /** Tailwind text class for icons in chips and the legend. */
  text: string;
  /** Stroke width at strength 0 and how much a full-strength connection adds. */
  width: { base: number; strength: number };
  /** Types never rely on color alone: solid, dotted or dashed. */
  dash?: string;
  lineCap: "round" | "butt";
}

/**
 * Saga coral, solid and thickest · universe mint, long dashes · director gold, solid ·
 * actor sky blue, solid · similar violet, dotted · genre blue-gray, dashed and thinnest.
 * Each type also has its icon (chips, legend, panel). The legend draws the same strokes.
 */
export const CONNECTION_STYLES: Record<ConnectionType, ConnectionStyle> = {
  SAGA: {
    label: "Saga",
    icon: Library,
    color: "var(--color-coral)",
    text: "text-coral",
    width: { base: 3, strength: 1.5 },
    lineCap: "round",
  },
  UNIVERSE: {
    label: "Universo",
    icon: Atom,
    color: "var(--color-mint)",
    text: "text-mint",
    width: { base: 2.5, strength: 1.25 },
    dash: "12 5",
    lineCap: "round",
  },
  DIRECTOR: {
    label: "Director",
    icon: Clapperboard,
    color: "var(--color-gold)",
    text: "text-gold",
    width: { base: 2.5, strength: 1.5 },
    lineCap: "round",
  },
  ACTOR: {
    label: "Actor",
    icon: Drama,
    color: "var(--color-sky)",
    text: "text-sky",
    width: { base: 1.75, strength: 1.25 },
    lineCap: "round",
  },
  SIMILAR: {
    label: "Similar",
    icon: Sparkles,
    color: "var(--color-violet-light)",
    text: "text-violet-light",
    width: { base: 2, strength: 1 },
    dash: "0.1 7",
    lineCap: "round",
  },
  GENRE: {
    label: "Género",
    icon: Tag,
    color: "var(--color-fg-muted)",
    text: "text-fg-muted",
    width: { base: 1, strength: 0.6 },
    dash: "7 6",
    lineCap: "butt",
  },
};

/** Legend order, and the order of the "zones" around the first ring. */
export const CONNECTION_ORDER: ConnectionType[] = ["SAGA", "UNIVERSE", "DIRECTOR", "ACTOR", "SIMILAR", "GENRE"];

export function strokeWidth(type: ConnectionType, strength: number): number {
  const { width } = CONNECTION_STYLES[type];
  return width.base + Math.min(1, Math.max(0, strength)) * width.strength;
}
