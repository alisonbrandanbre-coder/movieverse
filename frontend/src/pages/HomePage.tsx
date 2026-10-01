import { Orbit } from "lucide-react";
import { Link } from "react-router";

import { PageContainer } from "@/components/layout/PageContainer";
import { useAuth } from "@/features/auth/useAuth";

export function HomePage() {
  const { status } = useAuth();
  const ctaTarget = status === "authenticated" ? "/search" : "/register";

  return (
    <PageContainer className="flex flex-col items-center gap-6 py-20 text-center">
      <Orbit className="size-16 text-violet-400" aria-hidden />
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-white sm:text-5xl">
        Descubrí películas explorando sus conexiones
      </h1>
      <p className="max-w-xl text-lg text-slate-400">
        MovieVerse te ayuda a encontrar películas que realmente te gusten, más allá de los títulos de siempre.
      </p>
      <Link to={ctaTarget} className="rounded-lg bg-violet-500 px-6 py-3 font-medium text-white hover:bg-violet-400">
        Explorar MovieVerse
      </Link>
    </PageContainer>
  );
}
