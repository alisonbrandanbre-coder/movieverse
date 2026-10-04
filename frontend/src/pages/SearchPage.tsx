import { Search } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";

import { PageContainer, PageHeader } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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
    <PageContainer className="flex flex-col gap-10">
      <form role="search" onSubmit={handleSubmit} className="flex flex-col gap-6">
        <PageHeader eyebrow="Explorar" title="Buscar películas" />
        <div className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor="movie-search" className="sr-only">
            Título de la película
          </label>
          <div className="flex-1">
            <Input
              id="movie-search"
              icon={Search}
              inputSize="lg"
              emphasis
              type="search"
              autoFocus
              autoComplete="off"
              maxLength={100}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ej.: Interstellar"
            />
          </div>
          <Button type="submit" size="lg">
            Buscar
          </Button>
        </div>
      </form>
      <SearchResults query={urlQuery} page={page} onPageChange={handlePageChange} />
    </PageContainer>
  );
}
