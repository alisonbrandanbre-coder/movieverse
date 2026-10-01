import { UserRound } from "lucide-react";

import { PageContainer } from "@/components/layout/PageContainer";
import { useAuth } from "@/features/auth/useAuth";

const UPCOMING_TABS = ["Favoritas", "Pendientes", "Vistas", "Preferencias"];

export function ProfilePage() {
  const { user } = useAuth();

  return (
    <PageContainer>
      <div className="flex items-center gap-4">
        <div className="rounded-full bg-slate-800 p-4">
          <UserRound className="size-8 text-violet-400" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Mi perfil</h1>
          <p className="text-slate-400">{user?.email}</p>
        </div>
      </div>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {UPCOMING_TABS.map((tab) => (
          <li key={tab} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="font-medium text-slate-200">{tab}</p>
            <p className="text-sm text-slate-500">Próximamente</p>
          </li>
        ))}
      </ul>
    </PageContainer>
  );
}
