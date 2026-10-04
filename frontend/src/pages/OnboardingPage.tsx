import { Navigate, useNavigate } from "react-router";

import { PageContainer, PageHeader } from "@/components/layout/PageContainer";
import { LoadingState } from "@/components/ui/LoadingState";
import { OnboardingWizard } from "@/features/onboarding/components/OnboardingWizard";
import { usePreferences } from "@/features/preferences/hooks";

export function OnboardingPage() {
  const navigate = useNavigate();
  const preferences = usePreferences();

  if (preferences.isPending) return <LoadingState label="Cargando tu perfil…" />;
  // Already done: preferences are edited from Mi perfil → Preferencias.
  if (preferences.data?.onboardingCompleted) return <Navigate to="/discover" replace />;

  return (
    <PageContainer>
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <PageHeader
          eyebrow="Bienvenida"
          title="Armá tu constelación"
          description="Contanos qué te gusta en seis pasos rápidos. Con esto vamos a elegir tus recomendaciones."
        />
        <OnboardingWizard onCompleted={() => navigate("/discover", { replace: true })} />
      </div>
    </PageContainer>
  );
}
