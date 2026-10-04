import { Save } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";

import { getErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { buttonClasses } from "@/components/ui/buttonClasses";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { toDraft } from "@/features/preferences/api";
import {
  DecadesField,
  DiscoveryLevelField,
  DislikedGenresField,
  LanguagesField,
  PreferredGenresField,
} from "@/features/preferences/components/PreferenceFields";
import { usePreferenceOptions, usePreferences, useUpdatePreferences } from "@/features/preferences/hooks";
import type { PreferenceOptions, Preferences, PreferencesDraft } from "@/types/preferences";

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="eyebrow">{title}</h3>
        {hint && <p className="mt-1 text-sm text-fg-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function PreferencesForm({ preferences, options }: { preferences: Preferences; options: PreferenceOptions }) {
  const [draft, setDraft] = useState<PreferencesDraft>(() => toDraft(preferences));
  const [saved, setSaved] = useState(false);
  const update = useUpdatePreferences();
  const missingGenre = draft.preferredGenreIds.length === 0;

  function change(next: PreferencesDraft) {
    setDraft(next);
    setSaved(false);
  }

  const fieldProps = { options, draft, onChange: change };

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        update.mutate(draft, { onSuccess: () => setSaved(true) });
      }}
    >
      <Section title="Géneros favoritos" hint="Elegí al menos uno.">
        <PreferredGenresField {...fieldProps} />
      </Section>
      <Section title="Géneros a evitar">
        <DislikedGenresField {...fieldProps} />
      </Section>
      <Section title="Décadas">
        <DecadesField {...fieldProps} />
      </Section>
      <Section title="Idiomas">
        <LanguagesField {...fieldProps} />
      </Section>
      <Section title="Nivel de descubrimiento">
        <DiscoveryLevelField name="profile-discovery-level" {...fieldProps} />
      </Section>

      <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center">
        <Button type="submit" disabled={missingGenre || update.isPending}>
          <Save className="size-4" aria-hidden />
          {update.isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
        <p role="status" className={`text-sm ${update.isError || missingGenre ? "text-danger" : "text-violet-soft"}`}>
          {missingGenre
            ? "Elegí al menos un género favorito."
            : update.isError
              ? getErrorMessage(update.error, "No pudimos guardar tus preferencias.")
              : saved
                ? "Preferencias guardadas."
                : ""}
        </p>
      </div>
    </form>
  );
}

export function PreferencesTab() {
  const preferences = usePreferences();
  const options = usePreferenceOptions();

  if (preferences.isPending || options.isPending) return <LoadingState label="Cargando tus preferencias…" />;
  if (preferences.isError || options.isError) {
    return (
      <ErrorState
        title="No pudimos cargar tus preferencias"
        message={getErrorMessage(preferences.error ?? options.error)}
        onRetry={() => {
          void preferences.refetch();
          void options.refetch();
        }}
      />
    );
  }
  if (!preferences.data.onboardingCompleted) {
    return (
      <Card className="flex flex-col items-start gap-4 p-6">
        <p className="text-fg-secondary">Todavía no completaste el onboarding: son seis pasos rápidos.</p>
        <Link to="/onboarding" className={buttonClasses()}>
          Completar onboarding
        </Link>
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-8">
      <PreferencesForm preferences={preferences.data} options={options.data} />
    </Card>
  );
}
