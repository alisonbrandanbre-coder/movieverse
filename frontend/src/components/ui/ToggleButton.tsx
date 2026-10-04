import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

type Tone = "accent" | "danger";
type Size = "sm" | "md";

interface ToggleButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  pressed: boolean;
  icon: LucideIcon;
  /** Visible text. Omit for an icon-only button (then pass `aria-label`). */
  label?: string;
  tone?: Tone;
  size?: Size;
  /** Fill the icon when pressed. Turn off for icons that become a blob when filled (e.g. `Eye`). */
  fillWhenPressed?: boolean;
}

const PRESSED: Record<Tone, string> = {
  accent: "border-violet-light bg-violet/25 text-fg shadow-halo",
  danger: "border-danger-strong bg-danger-strong/15 text-danger",
};

const SIZES: Record<Size, string> = { sm: "px-3 py-2 text-sm", md: "px-4 py-2.5 text-sm" };

/**
 * On/off action with an icon (Favorita, Pendiente, Me gusta…). The pressed state is visible
 * (filled icon + violet halo) and exposed with `aria-pressed`; the icon pops when turned on.
 */
export function ToggleButton({
  pressed,
  icon: Icon,
  label,
  tone = "accent",
  size = "md",
  fillWhenPressed = true,
  className = "",
  ...props
}: ToggleButtonProps) {
  const state = pressed
    ? PRESSED[tone]
    : "border-line-strong bg-surface text-fg-secondary backdrop-blur-md hover:border-focus hover:bg-raised hover:text-fg";
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={`inline-flex items-center justify-center gap-2 rounded-control border font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-55 ${SIZES[size]} ${state} ${className}`}
      {...props}
    >
      <Icon aria-hidden className={`size-4 shrink-0 ${pressed ? `animate-pop ${fillWhenPressed ? "fill-current" : ""}` : ""}`} />
      {label}
    </button>
  );
}
