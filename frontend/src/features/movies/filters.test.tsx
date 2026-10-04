import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRoutes } from "@/AppRoutes";
import { jsonResponse, mockFetch } from "@/test/fetchMock";
import { INTERSTELLAR_SUMMARY_DTO, SEARCH_DTO } from "@/test/movieFixtures";
import { renderWithProviders, TEST_USER } from "@/test/render";
import { DEMO_PREFERENCES_DTO, OPTIONS_DTO } from "@/test/userFixtures";

import { activeFilterCount, filtersKey, NO_FILTERS, readFilters, writeFilters } from "./filters";

const DISCOVER_DTO = { query: "", page: 1, total_pages: 2, total_results: 25, results: [INTERSTELLAR_SUMMARY_DTO] };
const EMPTY_DTO = { query: "", page: 1, total_pages: 0, total_results: 0, results: [] };

function routes(extra: Parameters<typeof mockFetch>[0] = {}) {
  return mockFetch({
    "GET /auth/me": () => jsonResponse(TEST_USER),
    "GET /preferences": () => jsonResponse(DEMO_PREFERENCES_DTO),
    "GET /preferences/options": () => jsonResponse(OPTIONS_DTO),
    "GET /movies/trending": () => jsonResponse({ results: [], degraded: false }),
    "GET /movies/discover": () => jsonResponse(DISCOVER_DTO),
    "GET /movies/search": () => jsonResponse(SEARCH_DTO),
    ...extra,
  });
}

function lastCall(fetchMock: ReturnType<typeof mockFetch>, path: string): URL {
  const calls = fetchMock.mock.calls.map(([url]) => new URL(String(url))).filter((url) => url.pathname.endsWith(path));
  return calls[calls.length - 1];
}

describe("filters in the URL", () => {
  it("reads valid filters and ignores malformed ones", () => {
    expect(readFilters(new URLSearchParams("genres=4,15,4,x&decade=1990&rating=7&runtime=90"))).toEqual({
      genres: [4, 15],
      decade: 1990,
      rating: 7,
      runtime: 90,
    });
    expect(readFilters(new URLSearchParams("decade=1995&rating=9&runtime=100"))).toEqual(NO_FILTERS);
  });

  it("writes them keeping the text and dropping the empty ones", () => {
    const params = writeFilters(new URLSearchParams("q=star&rating=8"), { ...NO_FILTERS, genres: [15, 4], runtime: 120 });
    expect(params.get("q")).toBe("star");
    expect(params.get("genres")).toBe("15,4");
    expect(params.get("runtime")).toBe("120");
    expect(params.has("rating")).toBe(false);
  });

  it("counts every genre and has an order-independent key", () => {
    expect(activeFilterCount({ genres: [1, 2], decade: 1990, rating: null, runtime: 90 })).toBe(4);
    expect(filtersKey({ ...NO_FILTERS, genres: [2, 1] })).toBe(filtersKey({ ...NO_FILTERS, genres: [1, 2] }));
  });
});

describe("Buscar with filters", () => {
  it("without text, uses discover with the chosen filters", async () => {
    const fetchMock = routes();
    renderWithProviders(<AppRoutes />, { route: "/search", authenticated: true });

    await userEvent.click(await screen.findByRole("button", { name: /^Filtros/ }));
    const genres = screen.getByRole("group", { name: "Géneros" });
    await userEvent.click(await within(genres).findByRole("button", { name: "Ciencia ficción" }));
    await userEvent.click(within(genres).getByRole("button", { name: "Drama" }));
    await userEvent.click(within(screen.getByRole("group", { name: "Década" })).getByRole("button", { name: "Años 90" }));
    await userEvent.click(within(screen.getByRole("group", { name: "Puntaje mínimo" })).getByRole("button", { name: "7 o más" }));
    await userEvent.click(within(screen.getByRole("group", { name: "Duración" })).getByRole("button", { name: "Menos de 2 h" }));

    await waitFor(() => expect(lastCall(fetchMock, "/movies/discover")?.searchParams.get("runtime")).toBe("120"));
    const url = lastCall(fetchMock, "/movies/discover");
    expect(url.searchParams.get("genres")).toBe("15,7");
    expect(url.searchParams.get("decade")).toBe("1990");
    expect(url.searchParams.get("rating")).toBe("7");
    expect(await screen.findByText(/25 películas con estos filtros/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Póster de Interstellar/ })).toBeInTheDocument();
    expect(within(genres).getByRole("button", { name: "Drama" })).toHaveAttribute("aria-pressed", "true");
  });

  it("restores the filters from a shared link and filters the text search in the backend", async () => {
    const fetchMock = routes();
    renderWithProviders(<AppRoutes />, { route: "/search?q=interstellar&genres=15&rating=8", authenticated: true });

    expect(await screen.findByText(/2 resultados para “interstellar” con estos filtros/)).toBeInTheDocument();
    const url = lastCall(fetchMock, "/movies/search");
    expect(url.searchParams.get("q")).toBe("interstellar");
    expect(url.searchParams.get("genres")).toBe("15");
    expect(url.searchParams.get("rating")).toBe("8");
    // The panel opens by itself with the filters marked.
    expect(await screen.findByRole("button", { name: "Ciencia ficción" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "8 o más" })).toHaveAttribute("aria-pressed", "true");
  });

  it("«Limpiar filtros» goes back to the plain search", async () => {
    const fetchMock = routes();
    renderWithProviders(<AppRoutes />, { route: "/search?q=interstellar&decade=1990", authenticated: true });
    expect(await screen.findByText(/con estos filtros/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));

    expect(await screen.findByText("2 resultados para “interstellar”")).toBeInTheDocument();
    // The unfiltered page may come from the autocomplete's cache: some request had no filters.
    const searches = fetchMock.mock.calls.map(([url]) => new URL(String(url))).filter((u) => u.pathname.endsWith("/movies/search"));
    expect(searches.some((u) => !u.searchParams.has("decade"))).toBe(true);
    expect(screen.queryByRole("button", { name: "Limpiar filtros" })).not.toBeInTheDocument();
  });
});

describe("Descubrir with filters", () => {
  it("replaces the recommendations with the filtered catalog, with a way out when nothing matches", async () => {
    const fetchMock = routes({
      "GET /recommendations": () =>
        jsonResponse({ generated_at: "", discovery_level: "BALANCED", is_fallback: false, degraded: false, notice: null, sections: [] }),
      "GET /movies/discover": () => jsonResponse(EMPTY_DTO),
    });
    renderWithProviders(<AppRoutes />, { route: "/discover?runtime=90", authenticated: true });

    expect(await screen.findByText("Ninguna película coincide")).toBeInTheDocument();
    expect(lastCall(fetchMock, "/movies/discover").searchParams.get("runtime")).toBe("90");

    const clear = screen.getAllByRole("button", { name: "Limpiar filtros" });
    await userEvent.click(clear[clear.length - 1]);

    expect(await screen.findByText("Todavía no hay recomendaciones")).toBeInTheDocument();
  });
});
