import type { LucideIcon } from "lucide-react";
import { Clapperboard } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Call to action (usually a `buttonClasses()` link). */
  children?: ReactNode;
}

export function EmptyState({ title, description, icon: Icon = Clapperboard, children }: EmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-md animate-fade-up flex-col items-center gap-4 py-16 text-center">
      <div className="flex size-18 items-center justify-center rounded-full border border-violet-light/40 bg-violet/15 shadow-halo">
        <Icon className="size-8 text-violet-soft" aria-hidden />
      </div>
      <h2 className="font-display text-3xl tracking-wide text-fg">{title}</h2>
      {description && <p className="text-fg-secondary">{description}</p>}
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
