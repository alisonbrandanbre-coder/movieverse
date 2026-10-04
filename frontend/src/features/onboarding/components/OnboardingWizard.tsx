import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { getErrorMessage } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { LoadingState } from "@/components/ui/LoadingState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import {
  DecadesField,
  DiscoveryLevelField,
  DislikedGenresField,
  LanguagesField,
  PreferredGenresField,
} from "@/features/preferences/components/PreferenceFields";
import { EMPTY_DRAFT } from "@/features/preferences/draft";
import { useCompleteOnboarding, usePreferenceOptions } from "@/features/preferences/hooks";
import type { PreferenceOptions, PreferencesDraft, QuickRating, Reaction } from "@/types/preferences";

import { QuickRatingStep } from "./QuickRatingStep";

interface StepContext {
  options: PreferenceOptions;
  draft: PreferencesDraft;
  setDraft: (draft: PreferencesDraft) => void;
  ratings: Record<number, Reaction>;
  rate: (movieId: number, reaction: Reaction | null) => void;
}

interface Step {
  title: string;
  description: string;
  /** Message shown while the step cannot be completed yet. */
  requirement?: (draft: PreferencesDraft) => string | null;
  render: (ctx: StepContext) => ReactNode;
}

const STEPS: Step[] = [
  {
    title: "¿Qué géneros te encantan?",
    description: "Elegí al menos uno. Son el punto de partida de tu constelación.",
    requirement: (draft) => (draft.preferredGenreIds.length === 0 ? "Elegí al menos un género para continuar." : null),
    render: (ctx) => <PreferredGenresField options={ctx.options} draft={ctx.draft} onChange={ctx.setDraft} />,
  },
  {
    title: "¿Qué preferís evitar?",
    description: "Opcional. No vamos a recomendarte películas de estos géneros.",
    render: (ctx) => <DislikedGenresField options={ctx.options} draft={ctx.draft} onChange={ctx.setDraft} />,
  },
  {
    title: "¿Qué épocas te atraen?",
    description: "Opcional. Elegí todas las décadas que quieras.",
    render: (ctx) => <DecadesField options={ctx.options} draft={ctx.draft} onChange={ctx.setDraft} />,
  },
  {
    title: "¿En qué idiomas?",
    description: "Opcional. El idioma original de las películas que preferís.",
    render: (ctx) => <LanguagesField options={ctx.options} draft={ctx.draft} onChange={ctx.setDraft} />,
  },
  {
    title: "¿Cuánto querés explorar?",
    description: "Define cuánto te mostramos títulos conocidos o joyas menos obvias. Lo podés cambiar cuando quieras.",
    render: (ctx) => (
      <DiscoveryLevelField name="onboarding-discovery-level" options={ctx.options} draft={ctx.draft} onChange={ctx.setDraft} />
    ),
  },
  {
    title: "Valorá algunos títulos",
    description: "Opcional. Marcá los que te gustan o no te interesan; los que no conozcas, salteálos.",
    render: (ctx) => (
      <QuickRatingStep
        genreIds={ctx.draft.preferredGenreIds}
        avoidIds={ctx.draft.dislikedGenreIds}
        ratings={ctx.ratings}
        onRate={ctx.rate}
      />
    ),
  },
];

export function OnboardingWizard({ onCompleted }: { onCompleted: () => void }) {
  const options = usePreferenceOptions();
  const complete = useCompleteOnboarding();
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<PreferencesDraft>(EMPTY_DRAFT);
  const [ratings, setRatings] = useState<Record<number, Reaction>>({});
  const headingRef = useRef<HTMLHeadingElement>(null);
  const isFirstRender = useRef(true);

  // Move focus to the new step's title so keyboard and screen reader users follow along.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [stepIndex]);

  if (options.isPending) return <LoadingState label="Preparando tu onboarding…" />;
  if (options.isError) {
    return (
      <ErrorState title="No pudimos cargar las opciones" message={getErrorMessage(options.error)} onRetry={() => options.refetch()} />
    );
  }

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const blocker = step.requirement?.(draft) ?? null;
  const stepLabel = `Paso ${stepIndex + 1} de ${STEPS.length}`;

  function rate(movieId: number, reaction: Reaction | null) {
    setRatings((current) => {
      const next = { ...current };
      if (reaction) next[movieId] = reaction;
      else delete next[movieId];
      return next;
    });
  }

  function finish() {
    const quickRatings: QuickRating[] = Object.entries(ratings).map(([movieId, reaction]) => ({
      movieId: Number(movieId),
      reaction,
    }));
    complete.mutate({ draft, ratings: quickRatings }, { onSuccess: onCompleted });
  }

  return (
    <Card className="flex flex-col gap-6 p-5 sm:p-8">
      <div className="flex flex-col gap-3">
        <p className="eyebrow" aria-hidden>
          {stepLabel}
        </p>
        <ProgressBar value={stepIndex + 1} max={STEPS.length} label="Progreso del onboarding" valueText={stepLabel} />
      </div>

      <section aria-labelledby="onboarding-step-title" className="flex animate-fade-up flex-col gap-5" key={stepIndex}>
        <div className="flex flex-col gap-1.5">
          <h2
            id="onboarding-step-title"
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-3xl leading-none tracking-wide text-fg outline-none sm:text-4xl"
          >
            {step.title}
          </h2>
          <p className="text-fg-secondary">{step.description}</p>
        </div>
        {step.render({ options: options.data, draft, setDraft, ratings, rate })}
      </section>

      {complete.isError && (
        <p role="alert" className="rounded-control border border-danger-strong/40 bg-danger-strong/10 px-4 py-2.5 text-sm text-danger">
          {getErrorMessage(complete.error, "No pudimos guardar tus preferencias.")}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="secondary" disabled={stepIndex === 0 || complete.isPending} onClick={() => setStepIndex(stepIndex - 1)}>
          <ArrowLeft className="size-4" aria-hidden />
          Atrás
        </Button>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          {blocker && (
            <p id="onboarding-blocker" className="text-sm text-fg-muted">
              {blocker}
            </p>
          )}
          {isLast ? (
            <Button onClick={finish} disabled={complete.isPending}>
              <Check className="size-4" aria-hidden />
              {complete.isPending ? "Guardando…" : "Terminar"}
            </Button>
          ) : (
            <Button
              disabled={Boolean(blocker)}
              aria-describedby={blocker ? "onboarding-blocker" : undefined}
              onClick={() => setStepIndex(stepIndex + 1)}
            >
              Siguiente
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
