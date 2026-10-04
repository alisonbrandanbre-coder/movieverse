import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { AppRoutes } from "@/AppRoutes";
import { apiError, jsonResponse, mockFetch, pending } from "@/test/fetchMock";
import {
  EMPTY_SEARCH_DTO,
  INTERSTELLAR_CREDITS_DTO,
  INTERSTELLAR_DETAIL_DTO,
  SEARCH_DTO,
} from "@/test/movieFixtures";
import { renderWithProviders, TEST_USER } from "@/test/render";

import { MovieCard } from "./components/MovieCard";

const me = () => jsonResponse(TEST_USER);
const noInteractions = () =>
  jsonResponse({ movie_id: 1, favorite: false, watchlist: false, watched: false, reaction: null });

describe("MovieCard", () => {
  it("shows poster, title, year and rating and links to the detail", () => {
    render(
      <MemoryRouter>
        <MovieCard
          movie={{ id: 1, tmdbId: 157336, title: "Interstellar", releaseYear: 2014, posterUrl: "https://img/p.jpg", voteAverage: 8.4 }}
        />
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", { name: /Interstellar/ });
    expect(link).toHaveAttribute("href", "/movies/1");
    expect(screen.getByRole("img", { name: "Póster de Interstellar" })).toHaveAttribute("src", "https://img/p.jpg");
    expect(screen.getByText("2014")).toBeInTheDocument();
    expect(screen.getByLabelText("Puntuación 8.4")).toBeInTheDocument();
  });

  it("renders fallbacks when poster, year and rating are missing", () => {
    render(
      <MemoryRouter>
        <MovieCard movie={{ id: 2, tmdbId: 2, title: "Sin datos", releaseYear: null, posterUrl: null, voteAverage: 0 }} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("img", { name: "Póster de Sin datos" }).tagName).toBe("DIV");
    expect(screen.getByText("Sin fecha")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Puntuación/)).not.toBeInTheDocument();
  });
});

describe("SearchPage", () => {
  it("shows a hint before the user types", async () => {
    mockFetch({ "GET /auth/me": me });
    renderWithProviders(<AppRoutes />, { route: "/search", authenticated: true });

    expect(await screen.findByText("¿Qué querés ver hoy?")).toBeInTheDocument();
  });

  it("searches (debounced) and renders results from the API", async () => {
    const fetchMock = mockFetch({
      "GET /auth/me": me,
      "GET /movies/search": () => jsonResponse(SEARCH_DTO),
    });
    renderWithProviders(<AppRoutes />, { route: "/search", authenticated: true });

    await userEvent.type(await screen.findByRole("searchbox"), "interstellar");

    expect(await screen.findByRole("link", { name: /^Póster de Interstellar Interstellar/ })).toHaveAttribute(
      "href",
      "/movies/1",
    );
    expect(screen.getByText(/2 resultados/)).toBeInTheDocument();
    const searchCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("/movies/search"));
    expect(searchCalls).toHaveLength(1); // debounced: one request for the whole word
    expect(String(searchCalls[0][0])).toContain("q=interstellar");
  });

  it("shows a loading state while searching", async () => {
    mockFetch({ "GET /auth/me": me, "GET /movies/search": () => pending() });
    renderWithProviders(<AppRoutes />, { route: "/search?q=interstellar", authenticated: true });

    expect(await screen.findByText("Buscando películas…")).toBeInTheDocument();
  });

  it("shows an empty state when there are no results", async () => {
    mockFetch({ "GET /auth/me": me, "GET /movies/search": () => jsonResponse(EMPTY_SEARCH_DTO) });
    renderWithProviders(<AppRoutes />, { route: "/search?q=zzzz", authenticated: true });

    expect(await screen.findByText("Sin resultados")).toBeInTheDocument();
    expect(screen.getByText(/No encontramos películas para “zzzz”/)).toBeInTheDocument();
  });

  it("shows the API error and allows retrying", async () => {
    let calls = 0;
    mockFetch({
      "GET /auth/me": me,
      "GET /movies/search": () => {
        calls += 1;
        return calls === 1
          ? apiError(503, "TMDB_UNAVAILABLE", "El catálogo de películas no está disponible en este momento.")
          : jsonResponse(SEARCH_DTO);
      },
    });
    renderWithProviders(<AppRoutes />, { route: "/search?q=interstellar", authenticated: true });

    expect(await screen.findByRole("alert")).toHaveTextContent("El catálogo de películas no está disponible");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText(/2 resultados/)).toBeInTheDocument();
  });
});

describe("MovieDetailPage", () => {
  it("renders the full movie information, director and cast", async () => {
    mockFetch({
      "GET /auth/me": me,
      "GET /movies/1": () => jsonResponse(INTERSTELLAR_DETAIL_DTO),
      "GET /movies/1/credits": () => jsonResponse(INTERSTELLAR_CREDITS_DTO),
      "GET /movies/1/interactions": noInteractions,
    });
    renderWithProviders(<AppRoutes />, { route: "/movies/1", authenticated: true });

    expect(await screen.findByRole("heading", { level: 1, name: "Interstellar" })).toBeInTheDocument();
    expect(screen.getByText("2014")).toBeInTheDocument();
    expect(screen.getByText("2 h 49 min")).toBeInTheDocument();
    expect(screen.getByLabelText("Puntuación 8.4 de 10")).toBeInTheDocument();
    expect(screen.getByText("Ciencia ficción")).toBeInTheDocument();
    expect(screen.getByText(/agujero de gusano/)).toBeInTheDocument();
    expect(await screen.findByText("Christopher Nolan")).toBeInTheDocument();
    expect(screen.getByText("Matthew McConaughey")).toBeInTheDocument();
    expect(screen.getByText("Cooper")).toBeInTheDocument();
  });

  it("keeps the cinematic map disabled until Sprint 4", async () => {
    mockFetch({
      "GET /auth/me": me,
      "GET /movies/1": () => jsonResponse(INTERSTELLAR_DETAIL_DTO),
      "GET /movies/1/credits": () => jsonResponse(INTERSTELLAR_CREDITS_DTO),
      "GET /movies/1/interactions": noInteractions,
    });
    renderWithProviders(<AppRoutes />, { route: "/movies/1", authenticated: true });

    expect(await screen.findByRole("button", { name: /Explorar universo/ })).toBeDisabled();
  });

  it("shows a loading state", async () => {
    mockFetch({ "GET /auth/me": me, "GET /movies/1": () => pending() });
    renderWithProviders(<AppRoutes />, { route: "/movies/1", authenticated: true });

    expect(await screen.findByText("Cargando película…")).toBeInTheDocument();
  });

  it("shows not found for a missing movie", async () => {
    mockFetch({ "GET /auth/me": me, "GET /movies/99": () => apiError(404, "MOVIE_NOT_FOUND", "La película no existe.") });
    renderWithProviders(<AppRoutes />, { route: "/movies/99", authenticated: true });

    expect(await screen.findByText("Película no encontrada")).toBeInTheDocument();
  });

  it("shows an error state when the API fails", async () => {
    mockFetch({ "GET /auth/me": me, "GET /movies/1": () => apiError(500, "INTERNAL_ERROR", "Error interno del servidor.") });
    renderWithProviders(<AppRoutes />, { route: "/movies/1", authenticated: true });

    expect(await screen.findByText("No pudimos cargar la película")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("keeps the detail visible when only the credits fail", async () => {
    mockFetch({
      "GET /auth/me": me,
      "GET /movies/1": () => jsonResponse(INTERSTELLAR_DETAIL_DTO),
      "GET /movies/1/credits": () => apiError(503, "TMDB_UNAVAILABLE", "Catálogo no disponible."),
      "GET /movies/1/interactions": noInteractions,
    });
    renderWithProviders(<AppRoutes />, { route: "/movies/1", authenticated: true });

    expect(await screen.findByRole("heading", { level: 1, name: /Interstellar/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Catálogo no disponible."));
  });

  it("rejects non-numeric ids without calling the API", async () => {
    const fetchMock = mockFetch({ "GET /auth/me": me });
    renderWithProviders(<AppRoutes />, { route: "/movies/abc", authenticated: true });

    expect(await screen.findByText("Película no encontrada")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/movies/"))).toBe(false);
  });
});
