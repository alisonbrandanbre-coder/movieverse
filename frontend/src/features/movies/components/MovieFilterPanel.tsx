import { ChevronDown, Globe, SlidersHorizontal } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Collapsible } from "@/components/ui/Collapsible";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { usePreferenceOptions } from "@/features/preferences/hooks";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { formatDecade } from "@/utils/format";

import {
  activeFilterCount,
  COUNTRIES,
  MIN_RATINGS,
  POPULARITIES,
  RATED_MIN_VOTES,
  RUNTIMES,
  SORTS,
  toggle,
  type MovieFilters,
} from "../filters";
import { useWatchProviders } from "../hooks";
import { ActiveFilters } from "./ActiveFilters";
import { ProviderLogo } from "./ProviderLogo";

interface MovieFilterPanelProps {
  filters: MovieFilters;
  onChange: (filters: MovieFilters) => void;
}

/** Below this width the filters open in a bottom sheet. */
const MOBILE_QUERY = "(max-width: 767px)";

function FilterGroup({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-2.5">
      <p id={labelId} className="eyebrow">
        {label}
      </p>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {children}
      </div>
      {hint && <p className="text-xs text-fg-muted">{hint}</p>}
    </div>
  );
}

/** One choice of a single-choice group: "Cualquiera" (null) or a value; pressing it again clears it. */
function SingleChoice<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T | null;
  options: { value: T; label: ReactNode; ariaLabel?: string; title?: string }[];
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
          title={option.title}
          onClick={() => onChange(value === option.value ? null : option.value)}
        >
          {option.label}
        </Chip>
      ))}
    </>
  );
}

function ChipsSkeleton({ count }: { count: number }) {
  return Array.from({ length: count }, (_, i) => <Skeleton key={i} className="h-8 w-24 rounded-full" />);
}

/** How many of the filters inside "Más filtros" are set. */
function moreFiltersCount(filters: MovieFilters): number {
  return activeFilterCount({ ...filters, genres: [], providers: [] });
}

/** Géneros, Dónde verla and Ordenar por: always in sight. */
function MainFilters({ filters, onChange }: MovieFilterPanelProps) {
  const options = usePreferenceOptions();
  const providers = useWatchProviders();
  return (
    <>
      <FilterGroup label="Géneros">
        {options.data ? (
          options.data.genres.map((genre) => (
            <Chip
              key={genre.id}
              size="sm"
              selected={filters.genres.includes(genre.id)}
              onClick={() => onChange({ ...filters, genres: toggle(filters.genres, genre.id) })}
            >
              {genre.name}
            </Chip>
          ))
        ) : options.isError ? (
          <p className="text-sm text-fg-muted">No pudimos cargar los géneros.</p>
        ) : (
          <ChipsSkeleton count={8} />
        )}
      </FilterGroup>

      <FilterGroup label="Dónde verla">
        {providers.data ? (
          providers.data.length > 0 ? (
            providers.data.map((provider) => (
              <Chip
                key={provider.tmdbId}
                size="sm"
                selected={filters.providers.includes(provider.tmdbId)}
                onClick={() => onChange({ ...filters, providers: toggle(filters.providers, provider.tmdbId) })}
                className="inline-flex items-center gap-2 py-1 pl-1"
              >
                <ProviderLogo provider={provider} size="sm" />
                {provider.name}
              </Chip>
            ))
          ) : (
            <p className="text-sm text-fg-muted">Por ahora no hay plataformas para mostrar.</p>
          )
        ) : providers.isError ? (
          <p className="text-sm text-fg-muted">No pudimos cargar las plataformas.</p>
        ) : (
          <ChipsSkeleton count={6} />
        )}
      </FilterGroup>

      <FilterGroup label="Ordenar por">
        {SORTS.map((sort) => (
          <Chip key={sort.value} size="sm" selected={filters.sort === sort.value} onClick={() => onChange({ ...filters, sort: sort.value })}>
            {sort.label}
          </Chip>
        ))}
      </FilterGroup>
    </>
  );
}

/** Duración, Década, Puntaje mínimo, Popularidad, País de origen and "Ocultar las que ya vi". */
function MoreFilters({ filters, onChange }: MovieFilterPanelProps) {
  const options = usePreferenceOptions();
  return (
    <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
      <FilterGroup label="Duración">
        <SingleChoice
          value={filters.runtime}
          options={RUNTIMES.map((runtime) => ({
            value: runtime.value,
            ariaLabel: `${runtime.label} (${runtime.hint})`,
            label: (
              <span>
                {runtime.label} <span className="font-normal text-fg-muted">· {runtime.hint}</span>
              </span>
            ),
          }))}
          onChange={(runtime) => onChange({ ...filters, runtime })}
        />
      </FilterGroup>
      <FilterGroup label="Década">
        <SingleChoice
          value={filters.decade}
          options={(options.data?.decades ?? []).map((decade) => ({ value: decade, label: formatDecade(decade) }))}
          onChange={(decade) => onChange({ ...filters, decade })}
        />
      </FilterGroup>
      <FilterGroup label="Puntaje mínimo" hint={`Sólo cuentan las películas con al menos ${RATED_MIN_VOTES} votos.`}>
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
      <FilterGroup label="Popularidad">
        <SingleChoice
          value={filters.popularity}
          options={POPULARITIES.map((popularity) => ({ value: popularity.value, label: popularity.label }))}
          onChange={(popularity) => onChange({ ...filters, popularity })}
        />
      </FilterGroup>
      <FilterGroup label="País de origen">
        {COUNTRIES.map((country) => (
          <Chip
            key={country.code}
            size="sm"
            selected={filters.countries.includes(country.code)}
            aria-label={country.name}
            onClick={() => onChange({ ...filters, countries: toggle(filters.countries, country.code) })}
            className="inline-flex items-center gap-1.5"
          >
            {country.code === "OTHER" ? (
              <Globe className="size-3.5 text-violet-soft" aria-hidden />
            ) : (
              <span aria-hidden className="rounded-sm bg-raised px-1 text-[10px] font-bold tracking-wider text-label">
                {country.code}
              </span>
            )}
            {country.name}
          </Chip>
        ))}
      </FilterGroup>
      <div className="flex flex-col gap-2.5">
        <p className="eyebrow" aria-hidden>
          Tu historial
        </p>
        <Switch checked={filters.hideWatched} onChange={(hideWatched) => onChange({ ...filters, hideWatched })}>
          Ocultar las que ya vi
        </Switch>
      </div>
    </div>
  );
}

function MoreFiltersToggle({ open, controls, count, onToggle }: { open: boolean; controls: string; count: number; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      className="flex items-center gap-2 self-start rounded-control px-2 py-1.5 text-sm font-bold text-fg transition-colors hover:bg-violet/10 focus-visible:outline-2 focus-visible:outline-focus"
    >
      <SlidersHorizontal className="size-4 text-violet-soft" aria-hidden />
      Más filtros
      {count > 0 && (
        <span className="rounded-full bg-violet/25 px-2 py-0.5 text-xs text-fg" aria-label={`(${count} activos)`}>
          {count}
        </span>
      )}
      <ChevronDown className={`size-4 text-fg-muted transition-transform duration-300 ${open ? "rotate-180" : ""}`} aria-hidden />
    </button>
  );
}

/** Desktop: the panel in a card, "Más filtros" expands under the main filters. */
function DesktopPanel({ filters, onChange }: MovieFilterPanelProps) {
  const count = moreFiltersCount(filters);
  const [open, setOpen] = useState(count > 0);
  const moreId = useId();
  return (
    <Card className="flex flex-col gap-5 p-4 sm:p-5">
      <MainFilters filters={filters} onChange={onChange} />
      <div className="flex flex-col gap-4 border-t border-line pt-4">
        <MoreFiltersToggle open={open} controls={moreId} count={count} onToggle={() => setOpen((value) => !value)} />
        <Collapsible id={moreId} open={open} className="pb-1 pt-2">
          <MoreFilters filters={filters} onChange={onChange} />
        </Collapsible>
      </div>
    </Card>
  );
}

/** Mobile: a "Filtros" button that opens every filter in a bottom sheet. */
function MobilePanel({ filters, onChange }: MovieFilterPanelProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const count = activeFilterCount(filters);
  return (
    <>
      <Button variant="secondary" className="self-start" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="size-4" aria-hidden />
        Filtros
        {count > 0 && (
          <span className="rounded-full bg-violet/25 px-2 py-0.5 text-xs text-fg" aria-label={`(${count} activos)`}>
            {count}
          </span>
        )}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} labelledBy={titleId} placement="bottom">
        <div className="flex flex-col gap-6 p-5 pb-0">
          <div aria-hidden className="mx-auto -mt-2 h-1 w-10 rounded-full bg-line-strong" />
          <h2 id={titleId} className="font-display text-3xl leading-none tracking-wide text-fg">
            Filtros
          </h2>
          <MainFilters filters={filters} onChange={onChange} />
          <div className="border-t border-line pt-5">
            <MoreFilters filters={filters} onChange={onChange} />
          </div>
        </div>
        <div className="sticky bottom-0 mt-6 flex gap-3 border-t border-line bg-base/95 p-4 backdrop-blur-md">
          <Button className="flex-1" onClick={() => setOpen(false)}>
            Ver resultados
          </Button>
        </div>
      </Modal>
    </>
  );
}

/**
 * Buscar / Descubrir filters. Géneros, Dónde verla and Ordenar por are always in sight; the
 * rest is under "Más filtros" (open from the start when one of them is set). On mobile all
 * of them open in a bottom sheet. Underneath, the active filters as removable tags.
 */
export function MovieFilterPanel({ filters, onChange }: MovieFilterPanelProps) {
  const mobile = useMediaQuery(MOBILE_QUERY);
  return (
    <div className="flex flex-col gap-4">
      {mobile ? <MobilePanel filters={filters} onChange={onChange} /> : <DesktopPanel filters={filters} onChange={onChange} />}
      <ActiveFilters filters={filters} onChange={onChange} />
    </div>
  );
}
