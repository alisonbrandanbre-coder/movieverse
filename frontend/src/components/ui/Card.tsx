import type { HTMLAttributes } from "react";

type Variant = "glass" | "solid" | "outline";

const VARIANTS: Record<Variant, string> = {
  glass: "border border-line bg-surface backdrop-blur-md shadow-card",
  solid: "border border-line bg-raised",
  outline: "border border-line",
};

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  /** Adds the violet border/glow on hover. For clickable cards. */
  interactive?: boolean;
}

export function Card({ variant = "glass", interactive = false, className = "", ...props }: CardProps) {
  const hover = interactive ? "transition hover:border-focus hover:shadow-glow-strong" : "";
  return <div className={`rounded-card ${VARIANTS[variant]} ${hover} ${className}`} {...props} />;
}
