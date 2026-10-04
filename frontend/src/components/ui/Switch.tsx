import type { ButtonHTMLAttributes, ReactNode } from "react";

interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "onChange"> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Visible text next to the track; it is also the accessible name. */
  children: ReactNode;
}

/**
 * On/off setting that applies right away ("Ocultar las que ya vi"): a track with a knob that
 * slides, exposed as `role="switch"` + `aria-checked`. For actions on a movie use `ToggleButton`.
 */
export function Switch({ checked, onChange, children, className = "", ...props }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`group inline-flex items-center gap-3 rounded-control py-1 text-sm font-semibold text-fg-secondary transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${className}`}
      {...props}
    >
      <span
        aria-hidden
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
          checked ? "border-violet-light bg-violet/60 shadow-halo" : "border-line-strong bg-surface group-hover:border-focus"
        }`}
      >
        <span
          className={`absolute left-0.5 size-4.5 rounded-full bg-fg shadow-poster transition-transform ${checked ? "translate-x-5" : ""}`}
        />
      </span>
      <span className={checked ? "text-fg" : ""}>{children}</span>
    </button>
  );
}
