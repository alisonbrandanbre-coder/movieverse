import { useMemo } from "react";
import { useSearchParams } from "react-router";

import { NO_FILTERS, readFilters, writeFilters, type MovieFilters } from "./filters";

function readPage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/**
 * Filters and page of Buscar / Descubrir, kept in the URL (shareable, survive "back").
 * Changing a filter goes back to page 1 and keeps every other param (`q`).
 */
export function useFilterParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  const serialized = searchParams.toString();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `serialized` is the params' identity
  const filters = useMemo(() => readFilters(searchParams), [serialized]);
  const page = readPage(searchParams.get("page"));

  function setFilters(next: MovieFilters) {
    setSearchParams(
      (current) => {
        const params = writeFilters(current, next);
        params.delete("page");
        return params;
      },
      { replace: true },
    );
  }

  function setPage(next: number) {
    setSearchParams((current) => {
      const params = new URLSearchParams(current);
      if (next > 1) params.set("page", String(next));
      else params.delete("page");
      return params;
    });
    window.scrollTo?.({ top: 0 });
  }

  // Clearing the filters keeps the chosen order (it is not a filter).
  const clearFilters = () => setFilters({ ...NO_FILTERS, sort: filters.sort });

  return { filters, page, setFilters, setPage, clearFilters, searchParams, setSearchParams };
}
