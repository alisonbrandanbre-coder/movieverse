import { UserRound } from "lucide-react";
import { useSearchParams } from "react-router";

import { PageContainer } from "@/components/layout/PageContainer";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { useAuth } from "@/features/auth/useAuth";
import { useSavedMovies } from "@/features/interactions/hooks";
import { PreferencesTab } from "@/features/profile/components/PreferencesTab";
import { SavedMoviesTab } from "@/features/profile/components/SavedMoviesTab";
import type { SavedListKind } from "@/types/interactions";

type ProfileTab = "favoritas" | "pendientes" | "vistas" | "preferencias";

const LIST_BY_TAB: Partial<Record<ProfileTab, SavedListKind>> = {
  favoritas: "favorites",
  pendientes: "watchlist",
  vistas: "watched",
};

function isProfileTab(value: string | null): value is ProfileTab {
  return value === "favoritas" || value === "pendientes" || value === "vistas" || value === "preferencias";
}

export function ProfilePage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab: ProfileTab = isProfileTab(requested) ? requested : "favoritas";

  // First page of each list: shared cache with the tab content, used for the counters.
  const favorites = useSavedMovies("favorites", 1);
  const watchlist = useSavedMovies("watchlist", 1);
  const watched = useSavedMovies("watched", 1);

  const tabs: TabItem<ProfileTab>[] = [
    { value: "favoritas", label: "Favoritas", count: favorites.data?.totalResults },
    { value: "pendientes", label: "Pendientes", count: watchlist.data?.totalResults },
    { value: "vistas", label: "Vistas", count: watched.data?.totalResults },
    { value: "preferencias", label: "Preferencias" },
  ];
  const list = LIST_BY_TAB[tab];

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

      <Tabs label="Secciones del perfil" tabs={tabs} value={tab} onChange={(value) => setParams({ tab: value }, { replace: true })}>
        {list ? <SavedMoviesTab key={list} kind={list} /> : <PreferencesTab />}
      </Tabs>
    </PageContainer>
  );
}
