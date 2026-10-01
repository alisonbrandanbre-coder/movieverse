import type { LucideIcon } from "lucide-react";
import { Clapperboard } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children?: ReactNode;
}

export function EmptyState({ title, description, icon: Icon = Clapperboard, children }: EmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      <Icon className="size-10 text-slate-500" aria-hidden />
      <h2 className="text-lg font-semibold text-slate-200">{title}</h2>
      {description && <p className="text-sm text-slate-400">{description}</p>}
      {children}
    </div>
  );
}
