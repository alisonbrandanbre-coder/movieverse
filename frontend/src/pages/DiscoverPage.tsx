import { Compass, Search } from "lucide-react";
import { Link } from "react-router";

import { PageContainer, PageHeader } from "@/components/layout/PageContainer";
import { buttonClasses } from "@/components/ui/buttonClasses";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export function DiscoverPage() {
  return (
    <PageContainer className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Tu universo"
        title="Descubrir"
        description="Películas elegidas para vos y joyas menos obvias, conectadas por lo que más te gusta."
      />
      <Card className="px-6">
        <EmptyState
          icon={Compass}
          title="Tus recomendaciones llegan pronto"
          description="Mientras tanto, buscá tus películas favoritas: cada una suma una estrella a tu constelación."
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
