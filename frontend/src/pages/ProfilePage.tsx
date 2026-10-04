import { Search, Sparkles, UserRound } from "lucide-react";
import { Link } from "react-router";

import { PageContainer } from "@/components/layout/PageContainer";
import { buttonClasses } from "@/components/ui/buttonClasses";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/features/auth/useAuth";

const UPCOMING_TABS = ["Favoritas", "Pendientes", "Vistas", "Preferencias"];

export function ProfilePage() {
  const { user } = useAuth();

  return (
    <PageContainer className="flex flex-col gap-8">
      <header className="flex items-center gap-5">
        <div className="flex size-18 shrink-0 items-center justify-center rounded-full border border-violet-light/40 bg-violet/15 shadow-halo">
          <UserRound className="size-8 text-violet-soft" aria-hidden />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="eyebrow">Tu universo</p>
          <h1 className="font-display text-5xl leading-none tracking-wide text-fg sm:text-6xl">Mi perfil</h1>
          <p className="truncate text-fg-secondary">{user?.email}</p>
        </div>
      </header>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {UPCOMING_TABS.map((tab) => (
          <li key={tab}>
            <Card variant="solid" className="flex flex-col gap-1 p-5">
              <p className="font-bold text-fg">{tab}</p>
              <p className="eyebrow text-[10px] tracking-[3px] text-fg-muted">Próximamente</p>
            </Card>
          </li>
        ))}
      </ul>

      <Card className="px-6">
        <EmptyState
          icon={Sparkles}
          title="Tu constelación está vacía"
          description="Pronto vas a poder guardar favoritas, pendientes y vistas. Empezá explorando películas."
        >
          <Link to="/search" className={buttonClasses({ size: "lg" })}>
            <Search className="size-4" aria-hidden />
            Buscar películas
          </Link>
        </EmptyState>
      </Card>
    </PageContainer>
  );
}
