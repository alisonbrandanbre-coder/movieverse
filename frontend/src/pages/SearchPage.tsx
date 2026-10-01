import { Search } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";

import { PageContainer } from "@/components/layout/PageContainer";
import { SearchResults } from "@/features/movies/components/SearchResults";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const SEARCH_DEBOUNCE_MS = 400;

function readPage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const page = readPage(searchParams.get("page"));
  const [input, setInput] = useState(urlQuery);
  const debouncedInput = useDebouncedValue(input, SEARCH_DEBOUNCE_MS);

  // The URL is the source of truth so results survive "back" from a movie detail.
  useEffect(() => {
    if (debouncedInput.trim() !== urlQuery.trim()) {
      setSearchParams(debouncedInput.trim() ? { q: debouncedInput } : {}, { replace: true });
    }
    // Only react to the user's typing, not to URL changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedInput]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSearchParams(input.trim() ? { q: input } : {}, { replace: true });
  }

  function handlePageChange(nextPage: number) {
    setSearchParams({ q: urlQuery, page: String(nextPage) });
    window.scrollTo?.({ top: 0 });
  }

  return (
    <PageContainer className="flex flex-col gap-8">
      <form role="search" onSubmit={handleSubmit} className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-white">Buscar películas</h1>
        <div className="flex gap-2">
          <label htmlFor="movie-search" className="sr-only">
            Título de la película
          </label>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-500" aria-hidden />
            <input
              id="movie-search"
              type="search"
              autoFocus
              autoComplete="off"
              maxLength={100}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ej.: Interstellar"
              className="w-full rounded-lg border border-slate-700 bg-slate-900 py-3 pl-10 pr-3 text-slate-100 placeholder:text-slate-500 focus:outline-2 focus:outline-violet-400"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-violet-500 px-5 font-medium text-white hover:bg-violet-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
          >
            Buscar
          </button>
        </div>
      </form>
      <SearchResults query={urlQuery} page={page} onPageChange={handlePageChange} />
    </PageContainer>
  );
}
