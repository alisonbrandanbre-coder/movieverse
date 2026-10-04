/** Preference pickers shared by the onboarding wizard and the profile's "Preferencias" tab. */
import { Compass, Rocket, Scale } from "lucide-react";

import { ChoiceCard } from "@/components/ui/ChoiceCard";
import { Chip } from "@/components/ui/Chip";
import type { DiscoveryLevel, PreferenceOptions, PreferencesDraft } from "@/types/preferences";
import { formatDecade } from "@/utils/format";

import { toggleDislikedGenre, togglePreferredGenre, toggleValue } from "../draft";

interface FieldProps {
  options: PreferenceOptions;
  draft: PreferencesDraft;
  onChange: (draft: PreferencesDraft) => void;
}

interface ChipOption<T> {
  value: T;
  label: string;
}

function ChipGroup<T extends string | number>({
  label,
  options,
  selected,
  onToggle,
  tone,
}: {
  label: string;
  options: ChipOption<T>[];
  selected: T[];
  onToggle: (value: T) => void;
  tone?: "accent" | "danger";
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Chip key={option.value} selected={selected.includes(option.value)} tone={tone} onClick={() => onToggle(option.value)}>
          {option.label}
        </Chip>
      ))}
    </div>
  );
}

export function PreferredGenresField({ options, draft, onChange }: FieldProps) {
  return (
    <ChipGroup
      label="Géneros favoritos"
      options={options.genres.map((genre) => ({ value: genre.id, label: genre.name }))}
      selected={draft.preferredGenreIds}
      onToggle={(id) => onChange(togglePreferredGenre(draft, id))}
    />
  );
}

/** Favorite genres are not offered here: a genre cannot be both. */
export function DislikedGenresField({ options, draft, onChange }: FieldProps) {
  const available = options.genres.filter((genre) => !draft.preferredGenreIds.includes(genre.id));
  return (
    <ChipGroup
      label="Géneros a evitar"
      tone="danger"
      options={available.map((genre) => ({ value: genre.id, label: genre.name }))}
      selected={draft.dislikedGenreIds}
      onToggle={(id) => onChange(toggleDislikedGenre(draft, id))}
    />
  );
}

export function DecadesField({ options, draft, onChange }: FieldProps) {
  return (
    <ChipGroup
      label="Décadas"
      options={options.decades.map((decade) => ({ value: decade, label: formatDecade(decade) }))}
      selected={draft.decades}
      onToggle={(decade) => onChange({ ...draft, decades: toggleValue(draft.decades, decade) })}
    />
  );
}

export function LanguagesField({ options, draft, onChange }: FieldProps) {
  return (
    <ChipGroup
      label="Idiomas"
      options={options.languages.map((language) => ({ value: language.code, label: language.name }))}
      selected={draft.languages}
      onToggle={(code) => onChange({ ...draft, languages: toggleValue(draft.languages, code) })}
    />
  );
}

const LEVEL_ICONS: Record<DiscoveryLevel, typeof Compass> = { FAMILIAR: Compass, BALANCED: Scale, EXPLORER: Rocket };

export function DiscoveryLevelField({ options, draft, onChange, name }: FieldProps & { name: string }) {
  return (
    <div role="radiogroup" aria-label="Nivel de descubrimiento" className="grid gap-3 sm:grid-cols-3">
      {options.discoveryLevels.map((level) => (
        <ChoiceCard
          key={level.value}
          name={name}
          value={level.value}
          title={level.label}
          description={level.description}
          icon={LEVEL_ICONS[level.value]}
          checked={draft.discoveryLevel === level.value}
          onChange={() => onChange({ ...draft, discoveryLevel: level.value })}
        />
      ))}
    </div>
  );
}
