import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePreferenceOptions } from "@/features/preferences/hooks";
import { formatDecade } from "@/utils/format";

import { activeFilterCount, MIN_RATINGS, NO_FILTERS, RUNTIMES, type MovieFilters } from "../filters";

interface MovieFilterPanelProps {
  filters: MovieFilters;
  onChange: (filters: MovieFilters) => void;
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-2.5">
      <p id={labelId} className="eyebrow">
        {label}
      </p>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {children}
      </div>
    </div>
  );
}

/** One choice of a single-choice group: "Cualquiera" (null) or a value; pressing it again clears it. */
function SingleChoice<T extends number>({
  value,
  options,
  onChange,
}: {
  value: T | null;
  options: { value: T; label: ReactNode; ariaLabel?: string }[];
  onChange: (value: T | null) => void;
}) {
  return (
    <>
      <Chip size="sm" selected={value === null} onClick={() => onChange(null)}>
        Cualquiera
      </Chip>
      {options.map((option) => (
        <Chip
          key={option.value}
          size="sm"
          selected={value === option.value}
          aria-label={option.ariaLabel}
          onClick={() => onChange(value === option.value ? null : option.value)}
        >
          {option.label}
        </Chip>
      ))}
    </>
  );
}

/**
 * Buscar / Descubrir filters: genres (several, all must match), decade, minimum rating and
 * runtime. A "Filtros" toggle with the number of active filters opens the panel (open from
 * the start when the URL already has filters); "Limpiar filtros" resets them.
 */
export function MovieFilterPanel({ filters, onChange }: MovieFilterPanelProps) {
  const count = activeFilterCount(filters);
  const [open, setOpen] = useState(count > 0);
  const panelId = useId();
  const options = usePreferenceOptions();

  function toggleGenre(id: number) {
    const genres = filters.genres.includes(id) ? filters.genres.filter((g) => g !== id) : [...filters.genres, id];
    onChange({ ...filters, genres });
  }

  return (
    <Card className="flex flex-col gap-5 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="flex items-center gap-2 rounded-control px-2 py-1.5 text-sm font-bold text-fg transition-colors hover:bg-violet/10 focus-visible:outline-2 focus-visible:outline-focus"
        >
          <SlidersHorizontal className="size-4 text-violet-soft" aria-hidden />
          Filtros
          {count > 0 && (
            <span className="rounded-full bg-violet/25 px-2 py-0.5 text-xs text-fg" aria-label={`${count} activos`}>
              {count}
            </span>
          )}
          <ChevronDown className={`size-4 text-fg-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
        {count > 0 && (
          <Button variant="ghost" size="sm" onClick={() => onChange(NO_FILTERS)}>
            <X className="size-4" aria-hidden />
            Limpiar filtros
          </Button>
        )}
      </div>

      <div id={panelId} hidden={!open} className="flex flex-col gap-6">
        <FilterGroup label="Géneros">
          {options.data ? (
            options.data.genres.map((genre) => (
              <Chip key={genre.id} size="sm" selected={filters.genres.includes(genre.id)} onClick={() => toggleGenre(genre.id)}>
                {genre.name}
              </Chip>
            ))
          ) : options.isError ? (
            <p className="text-sm text-fg-muted">No pudimos cargar los géneros.</p>
          ) : (
            Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-8 w-20 rounded-full" />)
          )}
        </FilterGroup>

        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr_1fr]">
          <FilterGroup label="Década">
            <SingleChoice
              value={filters.decade}
              options={(options.data?.decades ?? []).map((decade) => ({ value: decade, label: formatDecade(decade) }))}
              onChange={(decade) => onChange({ ...filters, decade })}
            />
          </FilterGroup>
          <FilterGroup label="Puntaje mínimo">
            <SingleChoice
              value={filters.rating}
              options={MIN_RATINGS.map((rating) => ({
                value: rating,
                ariaLabel: `${rating} o más`,
                label: (
                  <span className="flex items-center gap-1">
                    <span className="text-gold" aria-hidden>
                      ★
                    </span>
                    {rating}+
                  </span>
                ),
              }))}
              onChange={(rating) => onChange({ ...filters, rating })}
            />
          </FilterGroup>
          <FilterGroup label="Duración">
            <SingleChoice
              value={filters.runtime}
              options={RUNTIMES.map((runtime) => ({ value: runtime.value, label: runtime.label }))}
              onChange={(runtime) => onChange({ ...filters, runtime })}
            />
          </FilterGroup>
        </div>
      </div>
    </Card>
  );
}
