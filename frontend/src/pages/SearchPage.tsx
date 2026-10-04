import { useEffect, useState, type FormEvent } from "react";

import { PageContainer, PageHeader } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { MovieFilterPanel } from "@/features/movies/components/MovieFilterPanel";
import { SearchAutocomplete } from "@/features/movies/components/SearchAutocomplete";
import { SearchResults } from "@/features/movies/components/SearchResults";
import { useFilterParams } from "@/features/movies/useFilterParams";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const SEARCH_DEBOUNCE_MS = 400;

export function SearchPage() {
  const { filters, page, setFilters, setPage, clearFilters, searchParams, setSearchParams } = useFilterParams();
  const urlQuery = searchParams.get("q") ?? "";
  const [input, setInput] = useState(urlQuery);
  const debouncedInput = useDebouncedValue(input, SEARCH_DEBOUNCE_MS);

  // Writes the text into the URL, keeping the filters; a new text starts at page 1.
  function commitQuery(value: string) {
    setSearchParams(
      (current) => {
        const params = new URLSearchParams(current);
        if (value.trim()) params.set("q", value);
        else params.delete("q");
        params.delete("page");
        return params;
      },
      { replace: true },
    );
  }

  // The URL is the source of truth so results survive "back" from a movie detail.
  useEffect(() => {
    if (debouncedInput.trim() !== urlQuery.trim()) commitQuery(debouncedInput);
    // Only react to the user's typing, not to URL changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedInput]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    commitQuery(input);
  }

  return (
    <PageContainer className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <form role="search" onSubmit={handleSubmit} className="flex flex-col gap-6">
          <PageHeader eyebrow="Explorar" title="Buscar películas" />
          <div className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="movie-search" className="sr-only">
              Título de la película
            </label>
            <div className="flex-1">
              <SearchAutocomplete id="movie-search" value={input} onChange={setInput} autoFocus placeholder="Ej.: Interstellar" />
            </div>
            <Button type="submit" size="lg">
              Buscar
            </Button>
          </div>
        </form>
        <MovieFilterPanel filters={filters} onChange={setFilters} />
      </div>
      <SearchResults query={urlQuery} page={page} onPageChange={setPage} filters={filters} onClearFilters={clearFilters} />
    </PageContainer>
  );
}
