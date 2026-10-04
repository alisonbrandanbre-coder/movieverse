import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AppRoutes } from "@/AppRoutes";
import { jsonResponse, mockFetch } from "@/test/fetchMock";
import { INTERSTELLAR_DETAIL_DTO, INTERSTELLAR_CREDITS_DTO, INTERSTELLAR_SUMMARY_DTO, SEARCH_DTO } from "@/test/movieFixtures";
import { renderWithProviders, TEST_USER } from "@/test/render";
import { DEMO_PREFERENCES_DTO, OPTIONS_DTO } from "@/test/userFixtures";

import { activeFilterCount, changesResults, filtersKey, NO_FILTERS, readFilters, writeFilters } from "./filters";

const DISCOVER_DTO = { query: "", page: 1, total_pages: 2, total_results: 25, results: [INTERSTELLAR_SUMMARY_DTO] };
const EMPTY_DTO = { query: "", page: 1, total_pages: 0, total_results: 0, results: [] };
const PROVIDERS_DTO = {
  region: "AR",
  results: [
    { tmdb_id: 8, name: "Netflix", logo_url: "https://image.tmdb.org/t/p/w92/netflix.jpg" },
    { tmdb_id: 337, name: "Disney Plus", logo_url: "https://image.tmdb.org/t/p/w92/disney.jpg" },
    { tmdb_id: 11, name: "MUBI", logo_url: null },
  ],
};

function routes(extra: Parameters<typeof mockFetch>[0] = {}) {
  return mockFetch({
    "GET /auth/me": () => jsonResponse(TEST_USER),
    "GET /preferences": () => jsonResponse(DEMO_PREFERENCES_DTO),
    "GET /preferences/options": () => jsonResponse(OPTIONS_DTO),
    "GET /movies/trending": () => jsonResponse({ results: [], degraded: false }),
    "GET /movies/providers": () => jsonResponse(PROVIDERS_DTO),
    "GET /movies/discover": () => jsonResponse(DISCOVER_DTO),
    "GET /movies/search": () => jsonResponse(SEARCH_DTO),
    ...extra,
  });
}

function lastCall(fetchMock: ReturnType<typeof mockFetch>, path: string): URL {
  const calls = fetchMock.mock.calls.map(([url]) => new URL(String(url))).filter((url) => url.pathname.endsWith(path));
  return calls[calls.length - 1];
}

function group(name: string) {
  return screen.getByRole("group", { name });
}

describe("filters in the URL", () => {
  it("reads valid filters and ignores malformed ones", () => {
    expect(
      readFilters(
        new URLSearchParams(
          "genres=4,15,4,x&providers=8,337,8&decade=1990&rating=7&runtime=long&countries=ar,KR,BR&popularity=hidden&sort=newest&hide_watched=1",
        ),
      ),
    ).toEqual({
      genres: [4, 15],
      providers: [8, 337],
      decade: 1990,
      rating: 7,
      runtime: "long",
      countries: ["AR", "KR"],
      popularity: "hidden",
      sort: "newest",
      hideWatched: true,
    });
    expect(readFilters(new URLSearchParams("decade=1995&rating=9&runtime=90&popularity=viral&sort=title&hide_watched=yes"))).toEqual(
      NO_FILTERS,
    );
  });

  it("writes them keeping the text and dropping the empty ones and the default order", () => {
    const params = writeFilters(new URLSearchParams("q=star&rating=8&sort=rating"), {
      ...NO_FILTERS,
      genres: [15, 4],
      providers: [8],
      runtime: "epic",
      countries: ["AR", "OTHER"],
      hideWatched: true,
    });
    expect(params.get("q")).toBe("star");
    expect(params.get("genres")).toBe("15,4");
    expect(params.get("providers")).toBe("8");
    expect(params.get("runtime")).toBe("epic");
    expect(params.get("countries")).toBe("AR,OTHER");
    expect(params.get("hide_watched")).toBe("1");
    expect(params.has("rating")).toBe(false);
    expect(params.has("sort")).toBe(false);
  });

  it("counts every genre, platform and country; the order is not a filter", () => {
    expect(
      activeFilterCount({ ...NO_FILTERS, genres: [1, 2], providers: [8], countries: ["AR"], runtime: "short", hideWatched: true, sort: "rating" }),
    ).toBe(6);
    expect(activeFilterCount({ ...NO_FILTERS, sort: "rating" })).toBe(0);
    expect(changesResults({ ...NO_FILTERS, sort: "rating" })).toBe(true);
    expect(filtersKey({ ...NO_FILTERS, genres: [2, 1], countries: ["KR", "AR"] })).toBe(
      filtersKey({ ...NO_FILTERS, genres: [1, 2], countries: ["AR", "KR"] }),
    );
  });
});

describe("Buscar with filters", () => {
  it("without text, combines main filters and «Más filtros» in one discover request", async () => {
    const fetchMock = routes();
    renderWithProviders(<AppRoutes />, { route: "/search", authenticated: true });

    // Géneros, Dónde verla and Ordenar por are in sight.
    await userEvent.click(await within(await screen.findByRole("group", { name: "Géneros" })).findByRole("button", { name: "Ciencia ficción" }));
    await userEvent.click(within(group("Géneros")).getByRole("button", { name: "Drama" }));
    await userEvent.click(await within(group("Dónde verla")).findByRole("button", { name: "Netflix" }));
    await userEvent.click(within(group("Dónde verla")).getByRole("button", { name: "MUBI" }));
    await userEvent.click(within(group("Ordenar por")).getByRole("button", { name: "Mejor puntaje" }));

    // The rest is collapsed until "Más filtros".
    expect(screen.queryByRole("group", { name: "Duración" })).not.toBeInTheDocument();
    const more = screen.getByRole("button", { name: /Más filtros/ });
    expect(more).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(within(group("Duración")).getByRole("button", { name: "Largas (120–150 min)" }));
    await userEvent.click(within(group("Década")).getByRole("button", { name: "Años 90" }));
    await userEvent.click(within(group("Puntaje mínimo")).getByRole("button", { name: "7 o más" }));
    await userEvent.click(within(group("Popularidad")).getByRole("button", { name: "Joyas ocultas" }));
    await userEvent.click(within(group("País de origen")).getByRole("button", { name: "Corea del Sur" }));
    await userEvent.click(within(group("País de origen")).getByRole("button", { name: "Otros" }));
    await userEvent.click(screen.getByRole("switch", { name: "Ocultar las que ya vi" }));

    await waitFor(() => expect(lastCall(fetchMock, "/movies/discover")?.searchParams.get("hide_watched")).toBe("1"));
    const url = lastCall(fetchMock, "/movies/discover");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: "1",
      genres: "15,7",
      providers: "8,11",
      sort: "rating",
      runtime: "long",
      decade: "1990",
      rating: "7",
      popularity: "hidden",
      countries: "KR,OTHER",
      hide_watched: "1",
    });
    expect(screen.getByText("Sólo cuentan las películas con al menos 100 votos.")).toBeInTheDocument();
    expect(await screen.findByText("25 películas con estos filtros, de mejor a peor puntaje")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Ocultar las que ya vi" })).toHaveAttribute("aria-checked", "true");
  });

  it("shows the active filters as tags with ✕, a counter and «Limpiar todo»", async () => {
    const fetchMock = routes();
    renderWithProviders(<AppRoutes />, {
      route: "/search?genres=15&providers=8&countries=AR&runtime=short&sort=oldest",
      authenticated: true,
    });

    const active = await screen.findByRole("region", { name: "Filtros activos" });
    expect(within(active).getByText("4 filtros activos")).toBeInTheDocument();
    expect(await within(active).findByText("Netflix")).toBeInTheDocument();
    expect(await within(active).findByText("Ciencia ficción")).toBeInTheDocument();
    expect(within(active).getByText("Cortas")).toBeInTheDocument();
    expect(within(active).getByText("Argentina")).toBeInTheDocument();

    await userEvent.click(within(active).getByRole("button", { name: "Quitar Netflix" }));
    await waitFor(() => expect(lastCall(fetchMock, "/movies/discover").searchParams.has("providers")).toBe(false));
    expect(within(active).getByText("3 filtros activos")).toBeInTheDocument();
    expect(within(group("Dónde verla")).getByRole("button", { name: "Netflix" })).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(within(active).getByRole("button", { name: "Limpiar todo" }));
    expect(screen.queryByRole("region", { name: "Filtros activos" })).not.toBeInTheDocument();
    // The order is kept: still the catalog, oldest first.
    await waitFor(() => expect(lastCall(fetchMock, "/movies/discover").searchParams.has("genres")).toBe(false));
    expect(lastCall(fetchMock, "/movies/discover").searchParams.get("sort")).toBe("oldest");
    expect(await screen.findByText("25 películas, de las más antiguas a las más recientes")).toBeInTheDocument();
  });

  it("restores the filters from a shared link and filters the text search in the backend", async () => {
    const fetchMock = routes();
    renderWithProviders(<AppRoutes />, { route: "/search?q=interstellar&genres=15&rating=8&popularity=blockbuster", authenticated: true });

    expect(await screen.findByText(/2 resultados para “interstellar” con estos filtros/)).toBeInTheDocument();
    const url = lastCall(fetchMock, "/movies/search");
    expect(url.searchParams.get("q")).toBe("interstellar");
    expect(url.searchParams.get("genres")).toBe("15");
    expect(url.searchParams.get("rating")).toBe("8");
    expect(url.searchParams.get("popularity")).toBe("blockbuster");
    // "Más filtros" opens by itself because one of its filters is set.
    expect(screen.getByRole("button", { name: /Más filtros/ })).toHaveAttribute("aria-expanded", "true");
    expect(within(group("Géneros")).getByRole("button", { name: "Ciencia ficción" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "8 o más" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Taquilleras" })).toHaveAttribute("aria-pressed", "true");
  });

  it("«Limpiar filtros» goes back to the plain search", async () => {
    const fetchMock = routes();
    renderWithProviders(<AppRoutes />, { route: "/search?q=interstellar&decade=1990", authenticated: true });
    expect(await screen.findByText(/con estos filtros/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Limpiar todo" }));

    expect(await screen.findByText("2 resultados para “interstellar”")).toBeInTheDocument();
    // The unfiltered page may come from the autocomplete's cache: some request had no filters.
    const searches = fetchMock.mock.calls.map(([url]) => new URL(String(url))).filter((u) => u.pathname.endsWith("/movies/search"));
    expect(searches.some((u) => !u.searchParams.has("decade"))).toBe(true);
    expect(screen.queryByRole("button", { name: "Limpiar todo" })).not.toBeInTheDocument();
  });

  it("on mobile, the filters open in a bottom sheet", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
    const fetchMock = routes();
    renderWithProviders(<AppRoutes />, { route: "/search?countries=JP", authenticated: true });

    expect(screen.queryByRole("group", { name: "Géneros" })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: /^Filtros/ }));

    const sheet = screen.getByRole("dialog", { name: "Filtros" });
    await userEvent.click(within(sheet).getByRole("button", { name: "Épicas (más de 150 min)" }));
    await userEvent.click(await within(sheet).findByRole("button", { name: "Disney Plus" }));
    await waitFor(() => expect(lastCall(fetchMock, "/movies/discover").searchParams.get("runtime")).toBe("epic"));
    expect(lastCall(fetchMock, "/movies/discover").searchParams.get("countries")).toBe("JP");

    await userEvent.click(within(sheet).getByRole("button", { name: "Ver resultados" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Filtros\s*\(3 activos\)/ })).toBeInTheDocument();
    expect(screen.getByText("3 filtros activos")).toBeInTheDocument();
  });
});

describe("Descubrir with filters", () => {
  it("replaces the recommendations with the filtered catalog, with a way out when nothing matches", async () => {
    const fetchMock = routes({
      "GET /recommendations": () =>
        jsonResponse({ generated_at: "", discovery_level: "BALANCED", is_fallback: false, degraded: false, notice: null, sections: [] }),
      "GET /movies/discover": () => jsonResponse(EMPTY_DTO),
    });
    renderWithProviders(<AppRoutes />, { route: "/discover?runtime=short", authenticated: true });

    expect(await screen.findByText("Ninguna película coincide")).toBeInTheDocument();
    expect(lastCall(fetchMock, "/movies/discover").searchParams.get("runtime")).toBe("short");

    await userEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));

    expect(await screen.findByText("Todavía no hay recomendaciones")).toBeInTheDocument();
  });
});

describe("Dónde verla in the movie detail", () => {
  function detailRoutes(providers: unknown) {
    return mockFetch({
      "GET /auth/me": () => jsonResponse(TEST_USER),
      "GET /preferences": () => jsonResponse(DEMO_PREFERENCES_DTO),
      "GET /movies/1": () => jsonResponse(INTERSTELLAR_DETAIL_DTO),
      "GET /movies/1/credits": () => jsonResponse(INTERSTELLAR_CREDITS_DTO),
      "GET /movies/1/providers": () => jsonResponse(providers),
      "GET /movies/1/interactions": () =>
        jsonResponse({ movie_id: 1, favorite: false, watchlist: false, watched: false, reaction: null }),
    });
  }

  it("lists the platforms of Argentina by kind, with their logos and TMDB's link", async () => {
    detailRoutes({
      region: "AR",
      link: "https://www.themoviedb.org/movie/157336/watch?locale=AR",
      streaming: [PROVIDERS_DTO.results[0], PROVIDERS_DTO.results[2]],
      rent: [{ tmdb_id: 2, name: "Apple TV", logo_url: "https://image.tmdb.org/t/p/w92/apple.jpg" }],
      buy: [],
    });
    renderWithProviders(<AppRoutes />, { route: "/movies/1", authenticated: true });

    const section = await screen.findByRole("region", { name: "Dónde verla" });
    expect(await within(section).findByText("Netflix")).toBeInTheDocument();
    expect(within(section).getByText("MUBI")).toBeInTheDocument();
    expect(within(section).getByRole("heading", { name: "En streaming" })).toBeInTheDocument();
    expect(within(section).getByRole("heading", { name: "Alquiler" })).toBeInTheDocument();
    expect(within(section).queryByRole("heading", { name: "Compra" })).not.toBeInTheDocument();
    expect(within(section).getByRole("link", { name: /Ver todas las opciones/ })).toHaveAttribute(
      "href",
      "https://www.themoviedb.org/movie/157336/watch?locale=AR",
    );
  });

  it("says when it is not available in Argentina", async () => {
    detailRoutes({ region: "AR", link: null, streaming: [], rent: [], buy: [] });
    renderWithProviders(<AppRoutes />, { route: "/movies/1", authenticated: true });

    expect(await screen.findByText("Por ahora no está disponible en plataformas de Argentina.")).toBeInTheDocument();
  });
});
