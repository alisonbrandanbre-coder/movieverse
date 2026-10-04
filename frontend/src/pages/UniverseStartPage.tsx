import { Heart, Orbit, Search, Sparkles, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import { getErrorMessage } from "@/api/client";
import { PageContainer, PageHeader } from "@/components/layout/PageContainer";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Input";
import { MovieGridSkeleton } from "@/components/ui/Skeleton";
import { useSavedMovies } from "@/features/interactions/hooks";
import { MovieGrid } from "@/features/movies/components/MovieGrid";
import { SEARCH_MIN_LENGTH } from "@/features/movies/api";
import { useMovieSearch } from "@/features/movies/hooks";
import { useOnboardingSample } from "@/features/preferences/hooks";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { MovieSummary } from "@/types/movie";

const SEARCH_DEBOUNCE_MS = 400;
const SEARCH_RESULTS = 10;
const STARTERS = 10;
const NO_GENRES: number[] = [];

function StartSection({ icon: Icon, title, description, children }: { icon: LucideIcon; title: string; description: string; children: ReactNode }) {
  const headingId = `start-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-5">
      <header className="flex items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border border-violet-light/40 bg-violet/15">
          <Icon className="size-5 text-violet-soft" aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <h2 id={headingId} className="font-display text-3xl leading-none tracking-wide text-fg">
            {title}
          </h2>
          <p className="text-sm text-fg-secondary">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function SearchStart({ query }: { query: string }) {
  const search = useMovieSearch(query);
  if (search.isPending) return <MovieGridSkeleton label="Buscando películas…" />;
  if (search.isError) {
    return <ErrorState title="No pudimos buscar" message={getErrorMessage(search.error)} onRetry={() => search.refetch()} />;
  }
  const movies = search.data.results.slice(0, SEARCH_RESULTS);
  if (movies.length === 0) {
    return <EmptyState icon={Search} title="Sin resultados" description={`No encontramos películas para «${query.trim()}».`} />;
  }
  return <MovieGrid movies={movies} destination="universe" />;
}

/** The user's favorites and likes (newest first, without repeats); popular titles when there are none. */
function PersonalStart() {
  const favorites = useSavedMovies("favorites", 1);
  const likes = useSavedMovies("likes", 1);
  const loaded = favorites.isSuccess && likes.isSuccess;
  const seen = new Set<number>();
  const own: MovieSummary[] = loaded
    ? [...favorites.data.results, ...likes.data.results].filter((movie) => !seen.has(movie.id) && seen.add(movie.id))
    : [];
  const needsSuggestions = loaded && own.length === 0;
  const popular = useOnboardingSample(NO_GENRES, NO_GENRES, needsSuggestions);

  if (favorites.isError || likes.isError) {
    const failed = favorites.isError ? favorites : likes;
    return (
      <ErrorState
        title="No pudimos cargar tus películas"
        message={getErrorMessage(failed.error)}
        onRetry={() => Promise.all([favorites.refetch(), likes.refetch()])}
      />
    );
  }
  if (!loaded) return <MovieGridSkeleton count={5} label="Cargando tus favoritas…" />;

  if (own.length > 0) {
    return (
      <StartSection icon={Heart} title="Empezá desde tus favoritas" description="Tus favoritas y las que te gustaron: elegí una para trazar su mapa.">
        <MovieGrid movies={own.slice(0, STARTERS)} destination="universe" />
      </StartSection>
    );
  }

  return (
    <StartSection
      icon={Sparkles}
      title="Películas para empezar"
      description="Todavía no marcaste favoritas ni «Me gusta». Arrancá por alguna de estas, muy conocidas."
    >
      {popular.isPending ? (
        <MovieGridSkeleton count={5} label="Buscando películas populares…" />
      ) : popular.isError ? (
        <ErrorState title="No pudimos cargar sugerencias" message={getErrorMessage(popular.error)} onRetry={() => popular.refetch()} />
      ) : popular.data.length === 0 ? (
        <p className="rounded-card border border-dashed border-line px-5 py-6 text-sm text-fg-muted">
          No hay sugerencias por ahora: buscá una película arriba.
        </p>
      ) : (
        <MovieGrid movies={popular.data.slice(0, STARTERS)} destination="universe" />
      )}
    </StartSection>
  );
}

/** `/universe`: choose the movie the cinematic map starts from. */
export function UniverseStartPage() {
  const [input, setInput] = useState("");
  const query = useDebouncedValue(input, SEARCH_DEBOUNCE_MS).trim();
  const searching = query.length >= SEARCH_MIN_LENGTH;

  return (
    <PageContainer className="flex flex-col gap-10">
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow="Mapa cinematográfico"
          title="Explorá el universo"
          description="Elegí una película y mirá cómo se conecta con otras por director, actores, similitud y género."
        />
        <form role="search" onSubmit={(event) => event.preventDefault()} className="max-w-2xl">
          <label htmlFor="universe-search" className="sr-only">
            Película de inicio
          </label>
          <Input
            id="universe-search"
            icon={Orbit}
            inputSize="lg"
            emphasis
            type="search"
            autoComplete="off"
            maxLength={100}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="¿Desde qué película empezamos? Ej.: Interstellar"
          />
        </form>
      </div>
      {searching ? (
        <StartSection icon={Search} title="Resultados" description="Tocá una película para empezar el mapa desde ella.">
          <SearchStart query={query} />
        </StartSection>
      ) : (
        <PersonalStart />
      )}
    </PageContainer>
  );
}
