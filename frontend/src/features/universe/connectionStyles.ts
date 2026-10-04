import type { ConnectionType } from "@/types/graph";

interface ConnectionStyle {
  label: string;
  /** CSS color from the design tokens (SVG strokes cannot use Tailwind classes). */
  color: string;
  /** Tailwind class for legend swatches and dots. */
  swatch: string;
  /** Dashed lines tell genres apart without relying on color alone. */
  dash?: string;
}

/** Director gold (the strongest link), actor blue, similar violet, genre blue-gray dashed. */
export const CONNECTION_STYLES: Record<ConnectionType, ConnectionStyle> = {
  DIRECTOR: { label: "Director", color: "var(--color-gold)", swatch: "bg-gold" },
  ACTOR: { label: "Actor", color: "var(--color-blue)", swatch: "bg-blue" },
  SIMILAR: { label: "Similar", color: "var(--color-violet-light)", swatch: "bg-violet-light" },
  GENRE: { label: "Género", color: "var(--color-fg-muted)", swatch: "bg-fg-muted", dash: "6 6" },
};

export const CONNECTION_ORDER: ConnectionType[] = ["DIRECTOR", "ACTOR", "SIMILAR", "GENRE"];
