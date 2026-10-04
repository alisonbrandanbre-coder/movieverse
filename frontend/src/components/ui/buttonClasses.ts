export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-white shadow-glow hover:brightness-115 hover:shadow-glow-strong disabled:opacity-55 disabled:shadow-none disabled:hover:brightness-100",
  secondary:
    "border border-line-strong bg-surface text-fg backdrop-blur-md hover:border-focus hover:bg-raised disabled:opacity-55 disabled:hover:border-line-strong disabled:hover:bg-surface",
  ghost: "text-fg-secondary hover:bg-violet/15 hover:text-fg disabled:opacity-55",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-3.5 py-2 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-md",
};

/** Button styles, also for `<Link>`s that should look like a button. */
export function buttonClasses({ variant = "primary", size = "md" }: { variant?: ButtonVariant; size?: ButtonSize } = {}): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]}`;
}
