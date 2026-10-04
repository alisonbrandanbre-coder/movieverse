import type { LucideIcon } from "lucide-react";
import type { InputHTMLAttributes } from "react";

interface ChoiceCardProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  title: string;
  description?: string;
  icon?: LucideIcon;
}

/** Radio option rendered as a card (one choice among a few, e.g. the discovery level). */
export function ChoiceCard({ title, description, icon: Icon, className = "", ...props }: ChoiceCardProps) {
  return (
    <label
      className={`flex cursor-pointer flex-col gap-2 rounded-card border border-line bg-surface p-5 backdrop-blur-md transition hover:border-focus has-checked:border-violet-light has-checked:bg-violet/20 has-checked:shadow-halo has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus ${className}`}
    >
      <input type="radio" className="sr-only" {...props} />
      <span className="flex items-center gap-2.5">
        {Icon && <Icon className="size-5 text-violet-soft" aria-hidden />}
        <span className="font-bold text-fg">{title}</span>
      </span>
      {description && <span className="text-sm text-fg-secondary">{description}</span>}
    </label>
  );
}
