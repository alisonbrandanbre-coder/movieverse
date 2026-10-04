import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppRoutes } from "@/AppRoutes";
import { rememberMapVisit } from "@/features/universe/history";
import { apiError, jsonResponse, mockFetch } from "@/test/fetchMock";
import { renderWithProviders, TEST_USER } from "@/test/render";
import { DEMO_PREFERENCES_DTO } from "@/test/userFixtures";
import type { MovieCard } from "@/types/movie";

import { HomeHero } from "./components/HomeHero";

function card(id: number, title: string, backdrop = true) {
  return {
    id,
    tmdb_id: 1000 + id,
    title,
    release_year: 2024,
    poster_url: `https://img/p${id}.jpg`,
    vote_average: 8.1,
    backdrop_url: backdrop ? `https://img/b${id}.jpg` : null,
    overview: `Sinopsis de ${title}.`,
  };
}

const TRENDING = {
  results: [card(1, "Dune: Parte dos"), card(2, "Anora"), card(3, "Sin backdrop", false), card(4, "Flow"), card(5, "Cónclave"), card(6, "Wicked")],
  degraded: false,
};

function heroMovies(): MovieCard[] {
  return TRENDING.results.map((dto) => ({
    id: dto.id,
    tmdbId: dto.tmdb_id,
    title: dto.title,
    releaseYear: dto.release_year,
    posterUrl: dto.poster_url,
    voteAverage: dto.vote_average,
    backdropUrl: dto.backdrop_url,
    overview: dto.overview,
  }));
}

function recommendations(titles: string[]) {
  return {
    generated_at: "2026-10-04T12:00:00Z",
    discovery_level: "EXPLORER",
    is_fallback: false,
    degraded: false,
    notice: null,
    sections: [
      {
        key: "FOR_YOU",
        items: titles.map((title, i) => ({ movie: card(50 + i, title), position: i + 1, popularity_bucket: "MEDIUM", explanation: "", scores: {} })),
      },
      { key: "HIDDEN_GEMS", items: [] },
      { key: "KEEP_EXPLORING", items: [] },
    ],
  };
}

function renderHome(routes: Parameters<typeof mockFetch>[0] = {}) {
  window.sessionStorage.setItem("mv:intro-seen", "1");
  mockFetch({
    "GET /auth/me": () => jsonResponse(TEST_USER),
    "GET /preferences": () => jsonResponse(DEMO_PREFERENCES_DTO),
    "GET /movies/trending": () => jsonResponse(TRENDING),
    "GET /recommendations": () => jsonResponse(recommendations(["Primer", "Coherence"])),
    ...routes,
  });
  return renderWithProviders(<AppRoutes />, { route: "/", authenticated: true });
}

const heroTitle = () => within(screen.getByRole("region", { name: "Películas en tendencia" })).getByRole("heading", { level: 2 });

afterEach(() => vi.useRealTimers());

describe("HomeHero", () => {
  function renderHero() {
    return render(
      <MemoryRouter>
        <HomeHero movies={heroMovies()} />
      </MemoryRouter>,
    );
  }

  it("shows 4 trending movies with a backdrop, with year, rating, synopsis and actions", () => {
    renderHero();

    expect(heroTitle()).toHaveTextContent("Dune: Parte dos");
    const hero = screen.getByRole("region", { name: "Películas en tendencia" });
    expect(within(hero).getByLabelText("Puntuación 8.1")).toBeInTheDocument();
    expect(within(hero).getByText("Sinopsis de Dune: Parte dos.")).toBeInTheDocument();
    expect(within(hero).getByRole("link", { name: /Ver ficha/ })).toHaveAttribute("href", "/movies/1");
    expect(within(hero).getByRole("link", { name: /Explorar universo/ })).toHaveAttribute("href", "/universe/1");
    // Movies without a backdrop are skipped; 4 dots for 4 slides.
    const dots = within(hero).getAllByRole("button", { name: /^Mostrar/ });
    expect(dots.map((d) => d.getAttribute("aria-label"))).toEqual([
      "Mostrar Dune: Parte dos (1 de 4)",
      "Mostrar Anora (2 de 4)",
      "Mostrar Flow (3 de 4)",
      "Mostrar Cónclave (4 de 4)",
    ]);
  });

  it("rotates every 7 seconds and pauses on hover", () => {
    vi.useFakeTimers();
    renderHero();

    act(() => vi.advanceTimersByTime(7000));
    expect(heroTitle()).toHaveTextContent("Anora");

    fireEvent.mouseEnter(screen.getByRole("region", { name: "Películas en tendencia" }));
    act(() => vi.advanceTimersByTime(21000));
    expect(heroTitle()).toHaveTextContent("Anora");

    fireEvent.mouseLeave(screen.getByRole("region", { name: "Películas en tendencia" }));
    act(() => vi.advanceTimersByTime(7000));
    expect(heroTitle()).toHaveTextContent("Flow");
  });

  it("the dots pick a movie", async () => {
    renderHero();

    await userEvent.click(screen.getByRole("button", { name: "Mostrar Flow (3 de 4)" }));

    expect(heroTitle()).toHaveTextContent("Flow");
    expect(screen.getByRole("button", { name: "Mostrar Flow (3 de 4)" })).toHaveAttribute("aria-current", "true");
  });

  it("does not rotate on its own with reduced motion", () => {
    vi.useFakeTimers();
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), media: query, addEventListener() {}, removeEventListener() {} }));
    renderHero();

    act(() => vi.advanceTimersByTime(30000));

    expect(heroTitle()).toHaveTextContent("Dune: Parte dos");
  });
});

describe("HomePage", () => {
  it("is the entry page with a session: hero, moods and carousels", async () => {
    renderHome();

    expect(await screen.findByRole("heading", { level: 1, name: "Inicio de MovieVerse" })).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Películas en tendencia" })).toBeInTheDocument();

    const moods = screen.getByRole("region", { name: "¿Cómo te sentís hoy?" });
    const links = within(moods).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/mood/para-reir",
      "/mood/para-pensar",
      "/mood/adrenalina",
      "/mood/para-llorar",
      "/mood/inspiradora",
      "/mood/miedo",
    ]);
    expect(within(moods).getByText("Para reír")).toBeInTheDocument();

    const trending = screen.getByRole("region", { name: "Tendencias de la semana" });
    expect(await within(trending).findByRole("link", { name: /^Póster de Anora/ })).toHaveAttribute("href", "/movies/2");
    const forYou = screen.getByRole("region", { name: "Para vos" });
    expect(await within(forYou).findByRole("link", { name: /^Póster de Primer/ })).toBeInTheDocument();
    expect(within(forYou).getByRole("link", { name: /Ver todas/ })).toHaveAttribute("href", "/discover");
    // No map history yet: no "Seguí explorando".
    expect(screen.queryByRole("region", { name: "Seguí explorando" })).not.toBeInTheDocument();
  });

  it("shows «Seguí explorando» with the movies last opened in the map", async () => {
    rememberMapVisit(TEST_USER.id, { id: 7, tmdbId: 7, title: "Interstellar", releaseYear: 2014, posterUrl: null, voteAverage: 8.4 });
    rememberMapVisit(TEST_USER.id, { id: 8, tmdbId: 8, title: "Arrival", releaseYear: 2016, posterUrl: null, voteAverage: 7.6 });
    renderHome();

    const history = await screen.findByRole("region", { name: "Seguí explorando" });
    const titles = within(history).getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(titles).toEqual(["Arrival", "Interstellar"]); // newest first
  });

  it("keeps working when the trending list fails", async () => {
    renderHome({ "GET /movies/trending": () => apiError(503, "TMDB_UNAVAILABLE", "El catálogo no está disponible.") });

    const trending = await screen.findByRole("region", { name: "Tendencias de la semana" });
    expect(await within(trending).findByRole("alert")).toHaveTextContent("El catálogo no está disponible.");
    expect(screen.queryByRole("region", { name: "Películas en tendencia" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "¿Cómo te sentís hoy?" })).toBeInTheDocument();
  });

  it("shows skeletons while loading", async () => {
    renderHome({ "GET /movies/trending": () => new Promise<Response>(() => undefined) });

    expect(await screen.findByRole("status", { name: "Cargando películas destacadas" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Cargando tendencias de la semana…" })).toBeInTheDocument();
  });

  it("is in the main menu as «Inicio»", async () => {
    renderHome();

    const nav = await screen.findByRole("navigation", { name: "Principal" });
    const home = await within(nav).findByRole("link", { name: "Inicio" });
    expect(home).toHaveAttribute("href", "/");
    expect(home).toHaveAttribute("aria-current", "page");
  });
});

describe("MoodPage", () => {
  function renderMood(slug: string, routes: Parameters<typeof mockFetch>[0]) {
    mockFetch({ "GET /auth/me": () => jsonResponse(TEST_USER), ...routes });
    return renderWithProviders(<AppRoutes />, { route: `/mood/${slug}`, authenticated: true });
  }

  it("lists the movies the backend chose for the mood", async () => {
    renderMood("para-reir", {
      "GET /movies/mood/para-reir": () =>
        jsonResponse({
          mood: { slug: "para-reir", label: "Para reír", description: "Comedias bien valoradas para despejarte." },
          page: 1,
          has_more: false,
          results: [card(20, "Superbad"), card(21, "Barbie")],
          degraded: false,
        }),
    });

    expect(await screen.findByRole("heading", { level: 1, name: "Para reír" })).toBeInTheDocument();
    expect(await screen.findByText("Comedias bien valoradas para despejarte.")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /^Póster de Superbad/ })).toHaveAttribute("href", "/movies/20");
    const others = screen.getByRole("navigation", { name: "Otros estados de ánimo" });
    expect(within(others).getAllByRole("link")).toHaveLength(5);
  });

  it("an unknown mood explains it and leads back home", async () => {
    renderMood("aburrido", {
      "GET /movies/mood/aburrido": () => apiError(404, "MOOD_NOT_FOUND", "Ese estado de ánimo no existe."),
    });

    expect(await screen.findByRole("heading", { name: "Ese estado de ánimo no existe" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Volver al inicio/ })).toHaveAttribute("href", "/");
  });

  it("says when TMDB is down and the list comes from the local catalog", async () => {
    renderMood("miedo", {
      "GET /movies/mood/miedo": () =>
        jsonResponse({
          mood: { slug: "miedo", label: "Miedo", description: "Terror." },
          page: 1,
          has_more: false,
          results: [card(30, "El conjuro")],
          degraded: true,
        }),
    });

    expect(await screen.findByText(/TMDB no responde en este momento/)).toBeInTheDocument();
  });
});

describe("Search autocomplete", () => {
  const results = Array.from({ length: 8 }, (_, i) => card(100 + i, `Matrix ${i + 1}`));

  function renderSearch() {
    const fetchMock = mockFetch({
      "GET /auth/me": () => jsonResponse(TEST_USER),
      "GET /movies/trending": () => jsonResponse(TRENDING),
      "GET /movies/search": () => jsonResponse({ query: "matrix", page: 1, total_pages: 1, total_results: 8, results }),
      "GET /movies/100": () => new Promise<Response>(() => undefined),
    });
    renderWithProviders(<AppRoutes />, { route: "/search", authenticated: true });
    return fetchMock;
  }

  it("suggests up to 6 movies with poster, title and year", async () => {
    renderSearch();
    const input = await screen.findByRole("combobox", { name: "Título de la película" });

    await userEvent.type(input, "matrix");

    const list = await screen.findByRole("listbox", { name: "Sugerencias" });
    const options = within(list).getAllByRole("option");
    expect(options).toHaveLength(6);
    expect(options[0]).toHaveTextContent("Matrix 1");
    expect(options[0]).toHaveTextContent("2024");
    expect(input).toHaveAttribute("aria-expanded", "true");
  });

  it("is keyboard navigable: ↓ highlights, Enter opens the movie, Escape closes", async () => {
    renderSearch();
    const input = await screen.findByRole("combobox", { name: "Título de la película" });
    await userEvent.type(input, "matrix");
    await screen.findByRole("listbox", { name: "Sugerencias" });

    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    const options = screen.getAllByRole("option");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", options[1].id);

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(input).toHaveAttribute("aria-expanded", "false"));

    // After Escape, ↓ reopens the list and the next ↓ highlights the first movie.
    await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(await screen.findByRole("status", { name: "Cargando película…" })).toBeInTheDocument(); // /movies/100
  });
});
