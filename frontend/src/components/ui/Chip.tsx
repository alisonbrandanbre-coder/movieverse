import type { ButtonHTMLAttributes } from "react";

type Tone = "accent" | "danger";

interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  selected: boolean;
  /** `danger` for negative choices (e.g. genres to avoid). */
  tone?: Tone;
  /** `sm` for dense groups (filters). */
  size?: "sm" | "md";
}

const SELECTED: Record<Tone, string> = {
  accent: "border-violet-light bg-violet/25 text-fg shadow-halo",
  danger: "border-danger-strong bg-danger-strong/15 text-danger",
};

/** Pill-shaped toggle for multi-select options (genres, decades, languages). Uses `aria-pressed`. */
export function Chip({ selected, tone = "accent", size = "md", className = "", children, ...props }: ChipProps) {
  const state = selected
    ? SELECTED[tone]
    : "border-line-strong bg-surface text-fg-secondary hover:border-focus hover:text-fg";
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`rounded-full border font-semibold ${size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"} transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-55 ${state} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
