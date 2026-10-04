import { X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { FilterTag } from "@/components/ui/FilterTag";
import { usePreferenceOptions } from "@/features/preferences/hooks";
import { formatDecade } from "@/utils/format";

import { activeFilterCount, COUNTRIES, NO_FILTERS, POPULARITIES, RUNTIMES, type MovieFilters } from "../filters";
import { useWatchProviders } from "../hooks";

interface ActiveFiltersProps {
  filters: MovieFilters;
  onChange: (filters: MovieFilters) => void;
}

interface Tag {
  key: string;
  label: ReactNode;
  name: string;
  without: MovieFilters;
}

/** One tag per active filter (each genre, platform and country on its own), in panel order. */
function useTags(filters: MovieFilters): Tag[] {
  const genres = usePreferenceOptions().data?.genres ?? [];
  const providers = useWatchProviders().data ?? [];
  const tags: Tag[] = [];

  filters.genres.forEach((id) => {
    const name = genres.find((g) => g.id === id)?.name ?? "Género";
    tags.push({ key: `g${id}`, label: name, name, without: { ...filters, genres: filters.genres.filter((g) => g !== id) } });
  });
  filters.providers.forEach((id) => {
    const name = providers.find((p) => p.tmdbId === id)?.name ?? "Plataforma";
    tags.push({ key: `p${id}`, label: name, name, without: { ...filters, providers: filters.providers.filter((p) => p !== id) } });
  });
  if (filters.runtime) {
    const runtime = RUNTIMES.find((r) => r.value === filters.runtime)!;
    tags.push({ key: "runtime", label: runtime.label, name: `${runtime.label} (${runtime.hint})`, without: { ...filters, runtime: null } });
  }
  if (filters.decade !== null) {
    const name = formatDecade(filters.decade);
    tags.push({ key: "decade", label: name, name, without: { ...filters, decade: null } });
  }
  if (filters.rating !== null) {
    tags.push({
      key: "rating",
      label: (
        <span>
          <span className="text-gold" aria-hidden>
            ★{" "}
          </span>
          {filters.rating}+
        </span>
      ),
      name: `${filters.rating} o más`,
      without: { ...filters, rating: null },
    });
  }
  if (filters.popularity) {
    const name = POPULARITIES.find((p) => p.value === filters.popularity)!.label;
    tags.push({ key: "popularity", label: name, name, without: { ...filters, popularity: null } });
  }
  filters.countries.forEach((code) => {
    const name = COUNTRIES.find((c) => c.code === code)!.name;
    tags.push({ key: `c${code}`, label: name, name, without: { ...filters, countries: filters.countries.filter((c) => c !== code) } });
  });
  if (filters.hideWatched) {
    tags.push({ key: "watched", label: "Sin las que ya vi", name: "Ocultar las que ya vi", without: { ...filters, hideWatched: false } });
  }
  return tags;
}

/**
 * Above the results: each active filter as a tag with ✕, how many there are and
 * "Limpiar todo" (which keeps the chosen order). Nothing when no filter is set.
 */
export function ActiveFilters({ filters, onChange }: ActiveFiltersProps) {
  const tags = useTags(filters);
  const count = activeFilterCount(filters);
  if (count === 0) return null;
  return (
    <div role="region" aria-label="Filtros activos" className="flex flex-wrap items-center gap-2">
      <p className="mr-1 text-sm font-semibold text-fg-secondary" aria-live="polite">
        {count} {count === 1 ? "filtro activo" : "filtros activos"}
      </p>
      {tags.map((tag) => (
        <FilterTag key={tag.key} removeLabel={`Quitar ${tag.name}`} onRemove={() => onChange(tag.without)}>
          {tag.label}
        </FilterTag>
      ))}
      <Button variant="ghost" size="sm" onClick={() => onChange({ ...NO_FILTERS, sort: filters.sort })}>
        <X className="size-4" aria-hidden />
        Limpiar todo
      </Button>
    </div>
  );
}
