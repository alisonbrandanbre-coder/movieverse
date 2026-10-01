import { Compass, Search } from "lucide-react";
import { Link } from "react-router";

import { PageContainer } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/ui/EmptyState";

export function DiscoverPage() {
  return (
    <PageContainer>
      <h1 className="text-2xl font-bold text-white">Descubrir</h1>
      <EmptyState
        icon={Compass}
        title="Tus recomendaciones llegan pronto"
        description="Acá vas a ver películas elegidas para vos y joyas menos obvias. Mientras tanto, buscá tus películas favoritas."
      >
        <Link
          to="/search"
          className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white hover:bg-violet-400"
        >
          <Search className="size-4" aria-hidden />
          Buscar películas
        </Link>
      </EmptyState>
    </PageContainer>
  );
}
