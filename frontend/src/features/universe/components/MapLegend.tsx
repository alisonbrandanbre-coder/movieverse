import { ChevronDown } from "lucide-react";
import { useState } from "react";

import type { ConnectionType } from "@/types/graph";

import { CONNECTION_ORDER, CONNECTION_STYLES, strokeWidth } from "../connectionStyles";

interface MapLegendProps {
  /** Types the user turned off: their edges are hidden. */
  hidden: ReadonlySet<ConnectionType>;
  onToggle: (type: ConnectionType) => void;
  className?: string;
}

function startsOpen(): boolean {
  // Phones start collapsed: the chips on the edges already name each type.
  return !(typeof window !== "undefined" && window.matchMedia?.("(max-width: 639px)").matches);
}

/**
 * Legend and filter: each type's stroke (same width, dash and color as on the map) and icon.
 * Clicking a type shows or hides its connections; the header collapses the whole legend.
 */
export function MapLegend({ hidden, onToggle, className = "" }: MapLegendProps) {
  const [open, setOpen] = useState(startsOpen);

  return (
    <div
      // Two columns keep all six types in three short rows; never taller than the map.
      className={`max-h-[calc(100%-6rem)] overflow-y-auto rounded-card border border-line bg-surface p-1.5 shadow-card backdrop-blur-md scrollbar-none ${className}`}
      aria-label="Leyenda de conexiones"
      role="group"
      data-map-overlay
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 rounded-control px-2.5 py-1.5 focus-visible:outline-2 focus-visible:outline-focus"
      >
        <span className="eyebrow text-[10px] tracking-[3px]">Conexiones</span>
        <ChevronDown className={`size-4 text-fg-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <ul className="grid grid-cols-2 gap-x-1 gap-y-0.5">
          {CONNECTION_ORDER.map((type) => {
            const style = CONNECTION_STYLES[type];
            const Icon = style.icon;
            const visible = !hidden.has(type);
            return (
              <li key={type}>
                <button
                  type="button"
                  aria-pressed={visible}
                  title={visible ? `Ocultar ${style.label.toLowerCase()}` : `Mostrar ${style.label.toLowerCase()}`}
                  onClick={() => onToggle(type)}
                  className={`flex w-full items-center gap-2 rounded-control px-2 py-1 text-xs font-semibold transition hover:bg-violet/15 focus-visible:outline-2 focus-visible:outline-focus ${
                    visible ? "text-fg-secondary" : "text-fg-muted opacity-50"
                  }`}
                >
                  <svg aria-hidden width="24" height="8" className="shrink-0 overflow-visible">
                    <line
                      x1="2"
                      y1="4"
                      x2="22"
                      y2="4"
                      stroke={style.color}
                      strokeWidth={strokeWidth(type, 0.8)}
                      strokeLinecap={style.lineCap}
                      strokeDasharray={style.dash}
                    />
                  </svg>
                  <Icon aria-hidden className={`size-3.5 shrink-0 ${style.text}`} />
                  <span className={visible ? "" : "line-through"}>{style.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
