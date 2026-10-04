import { Eye, Heart, Orbit, Plus, type LucideIcon } from "lucide-react";

import { Tooltip } from "@/components/ui/Tooltip";
import { buttonClasses } from "@/components/ui/buttonClasses";

// Placeholders: interactions arrive in Sprint 2 and the cinematic map in Sprint 4.
const PLANNED_ACTIONS: { label: string; icon: LucideIcon }[] = [
  { label: "Favorita", icon: Heart },
  { label: "Pendientes", icon: Plus },
  { label: "Vista", icon: Eye },
];

const SOON = "Próximamente";

export function MovieActions() {
  return (
    <div className="flex flex-col gap-4" aria-label="Acciones de la película">
      <Tooltip text={SOON} className="self-start">
        {(tooltipId) => (
          <button
            type="button"
            disabled
            aria-describedby={tooltipId}
            className={`${buttonClasses({ size: "lg" })} pointer-events-none px-9 text-lg`}
          >
            <Orbit className="size-5" aria-hidden />
            Explorar universo
          </button>
        )}
      </Tooltip>
      <div className="flex flex-wrap gap-2">
        {PLANNED_ACTIONS.map(({ label, icon: Icon }) => (
          <Tooltip key={label} text={SOON}>
            {(tooltipId) => (
              <button
                type="button"
                disabled
                aria-describedby={tooltipId}
                className={`${buttonClasses({ variant: "secondary", size: "sm" })} pointer-events-none`}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </button>
            )}
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
