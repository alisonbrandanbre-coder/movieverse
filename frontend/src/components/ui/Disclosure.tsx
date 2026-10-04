import type { LucideIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

interface DisclosureProps {
  /** Text of the toggle, e.g. "¿Por qué?". */
  label: string;
  /** Accessible name when the visible label is not enough, e.g. "¿Por qué Interstellar?". */
  ariaLabel?: string;
  icon?: LucideIcon;
  /** Revealed content. */
  children: ReactNode;
}

/** Small "show more" toggle (`aria-expanded` + `aria-controls`) with a panel underneath. */
export function Disclosure({ label, ariaLabel, icon: Icon, children }: DisclosureProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={ariaLabel}
        onClick={() => setOpen((value) => !value)}
        className={`inline-flex items-center gap-1.5 self-start rounded-control px-2 py-1 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-focus ${
          open ? "bg-violet/20 text-fg" : "text-violet-soft hover:bg-violet/10 hover:text-fg"
        }`}
      >
        {Icon && <Icon className="size-3.5" aria-hidden />}
        {label}
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="animate-fade-up rounded-control border border-line-strong bg-raised px-3 py-2.5 text-xs leading-relaxed text-fg-secondary shadow-poster"
      >
        {children}
      </div>
    </div>
  );
}
