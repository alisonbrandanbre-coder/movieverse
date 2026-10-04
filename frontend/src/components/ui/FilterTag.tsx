import { X } from "lucide-react";
import type { ReactNode } from "react";

interface FilterTagProps {
  /** What the tag shows (e.g. "Netflix", "★ 7+"). */
  children: ReactNode;
  /** Accessible name of the ✕, e.g. "Quitar Netflix". */
  removeLabel: string;
  onRemove: () => void;
}

/** An active filter shown above the results: its value and a ✕ that removes it. */
export function FilterTag({ children, removeLabel, onRemove }: FilterTagProps) {
  return (
    <span className="inline-flex animate-fade-up items-center gap-1 rounded-full border border-violet-light/60 bg-violet/20 py-1 pl-3 pr-1 text-xs font-semibold text-fg">
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="rounded-full p-1 text-fg-secondary transition-colors hover:bg-violet/30 hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </span>
  );
}
