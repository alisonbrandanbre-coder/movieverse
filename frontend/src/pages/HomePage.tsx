import { ArrowRight, History, Sparkles, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { getErrorMessage } from "@/api/client";
import { PageContainer } from "@/components/layout/PageContainer";
import { InlineError } from "@/components/ui/InlineError";
import { useAuth } from "@/features/auth/useAuth";
import { HomeHero } from "@/features/home/components/HomeHero";
import { MoodCards } from "@/features/moods/components/MoodCards";
import { MovieCarousel } from "@/features/movies/components/MovieCarousel";
import { useTrending } from "@/features/movies/hooks";
import { useRecommendations } from "@/features/recommendations/hooks";
import { readMapHistory } from "@/features/universe/history";

const FOR_YOU_IN_HOME = 12;

function SeeAll({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-1 rounded-control px-2 py-1 text-sm font-semibold text-violet-soft hover:text-fg focus-visible:outline-2 focus-visible:outline-focus"
    >
      {label}
      <ArrowRight className="size-4" aria-hidden />
    </Link>
  );
}

/**
 * Home (`/` with a session): trending hero, moods, and carousels of trending movies, the
 * user's first recommendations and the movies they last opened in the map.
 */
export function HomePage() {
  const { user } = useAuth();
  const trending = useTrending();
  const recommendations = useRecommendations();
  const [history] = useState(() => readMapHistory(user?.id));
  const forYou = recommendations.data?.sections.find((s) => s.key === "FOR_YOU")?.movies.slice(0, FOR_YOU_IN_HOME);

  return (
    <>
      <h1 className="sr-only">Inicio de MovieVerse</h1>
      {!trending.isError && <HomeHero movies={trending.data?.movies} />}

      <PageContainer className="flex flex-col gap-14">
        <MoodCards />

        <MovieCarousel
          title="Tendencias de la semana"
          description="Lo que más se está viendo en el mundo."
          icon={TrendingUp}
          movies={trending.data?.movies}
          fallback={
            trending.isError ? (
              <InlineError
                message={getErrorMessage(trending.error, "No pudimos cargar las tendencias.")}
                onRetry={() => trending.refetch()}
              />
            ) : undefined
          }
        />

        <MovieCarousel
          title="Para vos"
          description="Las primeras de tus recomendaciones."
          icon={Sparkles}
          action={<SeeAll to="/discover" label="Ver todas" />}
          movies={forYou}
          fallback={
            recommendations.isError ? (
              <InlineError
                message={getErrorMessage(recommendations.error, "No pudimos cargar tus recomendaciones.")}
                onRetry={() => recommendations.refetch()}
              />
            ) : undefined
          }
        />

        {history.length > 0 && (
          <MovieCarousel
            title="Seguí explorando"
            description="Las últimas películas que abriste en el mapa."
            icon={History}
            movies={history}
          />
        )}
      </PageContainer>
    </>
  );
}
