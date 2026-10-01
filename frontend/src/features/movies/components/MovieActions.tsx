import { Eye, Heart, Orbit, Plus, type LucideIcon } from "lucide-react";

interface PlannedAction {
  label: string;
  icon: LucideIcon;
}

// Placeholders: interactions arrive in Sprint 2 and the cinematic map in Sprint 4.
const PLANNED_ACTIONS: PlannedAction[] = [
  { label: "Favorita", icon: Heart },
  { label: "Pendientes", icon: Plus },
  { label: "Vista", icon: Eye },
  { label: "Explorar universo", icon: Orbit },
];

export function MovieActions() {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Acciones de la película">
      {PLANNED_ACTIONS.map(({ label, icon: Icon }) => (
        <button
          key={label}
          type="button"
          disabled
          title="Próximamente"
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-400"
        >
          <Icon className="size-4" aria-hidden />
          {label}
          <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
            Próximamente
          </span>
        </button>
      ))}
    </div>
  );
}
