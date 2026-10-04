import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRoutes } from "@/AppRoutes";
import { apiError, jsonResponse, mockFetch, pending } from "@/test/fetchMock";
import { INTERSTELLAR_SUMMARY_DTO } from "@/test/movieFixtures";
import { renderWithProviders, TEST_USER } from "@/test/render";
import { DEMO_PREFERENCES_DTO } from "@/test/userFixtures";

const me = () => jsonResponse(TEST_USER);
const preferences = () => jsonResponse(DEMO_PREFERENCES_DTO);

function item(id: number, title: string, explanation: string, bucket = "MEDIUM") {
  return {
    movie: { ...INTERSTELLAR_SUMMARY_DTO, id, tmdb_id: 1000 + id, title },
    position: 1,
    popularity_bucket: bucket,
    explanation,
    scores: { affinity: 0.8, novelty: 0.4, quality: 0.7, diversity: 1, exploration: 1, popularity_penalty: 0.02, final: 0.66 },
  };
}

function recommendations(overrides: Record<string, unknown> = {}, sections?: Record<string, unknown[]>) {
  const items = sections ?? {
    FOR_YOU: [item(10, "Primer", "Porque te gustó Interstellar y preferís ciencia ficción; es menos conocida que la mayoría.")],
    HIDDEN_GEMS: [item(11, "Coherence", "Porque preferís suspense; es una joya poco conocida.", "HIDDEN")],
    KEEP_EXPLORING: [item(12, "Contact", "Porque tenés Interstellar entre tus favoritas.")],
  };
  return {
    generated_at: "2026-10-04T12:00:00Z",
    discovery_level: "EXPLORER",
    is_fallback: false,
    degraded: false,
    notice: null,
    sections: ["FOR_YOU", "HIDDEN_GEMS", "KEEP_EXPLORING"].map((key) => ({ key, items: items[key] ?? [] })),
    ...overrides,
  };
}

function renderDiscover(routes: Parameters<typeof mockFetch>[0]) {
  const fetchMock = mockFetch({ "GET /auth/me": me, "GET /preferences": preferences, ...routes });
  renderWithProviders(<AppRoutes />, { route: "/discover", authenticated: true });
  return fetchMock;
}

describe("DiscoverPage", () => {
  it("renders the three sections with the movies from the API", async () => {
    renderDiscover({ "GET /recommendations": () => jsonResponse(recommendations()) });

    const forYou = await screen.findByRole("region", { name: "Para vos" });
    expect(within(forYou).getByRole("link", { name: /^Póster de Primer/ })).toHaveAttribute("href", "/movies/10");
    expect(within(screen.getByRole("region", { name: "Joyas para descubrir" })).getByText("Coherence")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Continuá explorando" })).getByText("Contact")).toBeInTheDocument();
  });

  it("shows the explanation from the API when tapping «¿Por qué?»", async () => {
    renderDiscover({ "GET /recommendations": () => jsonResponse(recommendations()) });

    const why = await screen.findByRole("button", { name: "¿Por qué Primer?" });
    const explanation = "Porque te gustó Interstellar y preferís ciencia ficción; es menos conocida que la mayoría.";
    expect(why).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText(explanation)).not.toBeVisible();

    await userEvent.click(why);

    expect(why).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(explanation)).toBeVisible();
    await userEvent.click(why);
    expect(screen.getByText(explanation)).not.toBeVisible();
  });

  it("refreshes the recommendations", async () => {
    let refreshed = false;
    renderDiscover({
      "GET /recommendations": () => jsonResponse(recommendations()),
      "POST /recommendations/refresh": () => {
        refreshed = true;
        return jsonResponse(recommendations({}, { FOR_YOU: [item(20, "Moon", "Porque preferís ciencia ficción.")] }));
      },
    });

    await userEvent.click(await screen.findByRole("button", { name: /Refrescar/ }));

    expect(await screen.findByRole("link", { name: /^Póster de Moon/ })).toBeInTheDocument();
    expect(screen.queryByText("Primer")).not.toBeInTheDocument();
    expect(screen.getByText("Recomendaciones actualizadas.")).toBeInTheDocument();
    expect(refreshed).toBe(true);
  });

  it("explains when refreshing fails and keeps the current list", async () => {
    renderDiscover({
      "GET /recommendations": () => jsonResponse(recommendations()),
      "POST /recommendations/refresh": () => apiError(429, "THROTTLED", "Demasiadas solicitudes."),
    });

    await userEvent.click(await screen.findByRole("button", { name: /Refrescar/ }));

    expect(await screen.findByText("Demasiadas solicitudes.")).toBeInTheDocument();
    expect(screen.getByText("Primer")).toBeInTheDocument();
  });

  it("shows a loading state", async () => {
    renderDiscover({ "GET /recommendations": () => pending() });

    expect(await screen.findByText("Buscando películas para vos…")).toBeInTheDocument();
  });

  it("shows an error state with retry", async () => {
    let calls = 0;
    renderDiscover({
      "GET /recommendations": () => {
        calls += 1;
        return calls === 1 ? apiError(500, "INTERNAL_ERROR", "Error interno del servidor.") : jsonResponse(recommendations());
      },
    });

    expect(await screen.findByText("No pudimos cargar tus recomendaciones")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("region", { name: "Para vos" })).toBeInTheDocument();
  });

  it("shows an empty state when there is nothing to recommend", async () => {
    renderDiscover({ "GET /recommendations": () => jsonResponse(recommendations({}, {})) });

    expect(await screen.findByText("Todavía no hay recomendaciones")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Buscar películas/ })).toHaveAttribute("href", "/search");
  });

  it("shows a per-section message when one section is empty", async () => {
    renderDiscover({
      "GET /recommendations": () =>
        jsonResponse(recommendations({}, { FOR_YOU: [item(10, "Primer", "Porque preferís ciencia ficción.")] })),
    });

    const keep = await screen.findByRole("region", { name: "Continuá explorando" });
    expect(within(keep).getByText(/Marcá favoritas/)).toBeInTheDocument();
  });

  it("shows the notice of a degraded or fallback response", async () => {
    renderDiscover({
      "GET /recommendations": () =>
        jsonResponse(
          recommendations({
            is_fallback: true,
            notice: "Todavía no completaste el onboarding: te mostramos películas populares y bien valoradas.",
          }),
        ),
    });

    expect(await screen.findByText(/te mostramos películas populares y bien valoradas/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Completar onboarding" })).toHaveAttribute("href", "/onboarding");
  });

  it("does not compute anything: the API order and text are shown as is", async () => {
    renderDiscover({
      "GET /recommendations": () =>
        jsonResponse(
          recommendations({}, {
            FOR_YOU: [item(30, "Zeta", "Texto A."), item(31, "Alfa", "Texto B.")],
          }),
        ),
    });

    const forYou = await screen.findByRole("region", { name: "Para vos" });
    const links = within(forYou).getAllByRole("link", { name: /^Póster de/ }).map((link) => link.textContent);
    expect(links[0]).toContain("Zeta");
    expect(links[1]).toContain("Alfa");
    await waitFor(() => expect(screen.getByText("Texto A.")).toBeInTheDocument());
  });
});
