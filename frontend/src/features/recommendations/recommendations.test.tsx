import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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

    expect(await screen.findByRole("status", { name: "Buscando películas para vos…" })).toBeInTheDocument();
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

describe("Surprise mode", () => {
  function surprise(id: number, title: string, bucket = "HIDDEN") {
    return {
      movie: { ...INTERSTELLAR_SUMMARY_DTO, id, tmdb_id: 2000 + id, title },
      section: "HIDDEN_GEMS",
      popularity_bucket: bucket,
      explanation: `Porque preferís ciencia ficción; ${title} es una joya poco conocida.`,
    };
  }
  const hand = (...items: ReturnType<typeof surprise>[]) => jsonResponse({ items });
  const FIRST = () => hand(surprise(20, "Coherence"), surprise(21, "Moon", "MEDIUM"), surprise(22, "Paddington", "POPULAR"));
  const SECOND = () => hand(surprise(30, "Primer"), surprise(31, "Arrival", "POPULAR"), surprise(32, "Amélie", "MEDIUM"));

  const cardButton = (dialog: HTMLElement, title: string) => within(dialog).findByRole("button", { name: new RegExp(`^${title}`) });

  it("deals three face-down tickets that turn over into three different movies", async () => {
    renderDiscover({ "GET /recommendations": () => jsonResponse(recommendations()), "GET /recommendations/surprise": FIRST });

    await userEvent.click(await screen.findByRole("button", { name: "Sorprendeme" }));

    const dialog = await screen.findByRole("dialog", { name: "Elegí tu función" });
    // Face down first: the movies are not exposed until their ticket turns over.
    expect(within(dialog).queryByRole("button", { name: /^Coherence/ })).not.toBeInTheDocument();
    expect(within(dialog).getAllByText(/Entrada · Función/)).toHaveLength(3);

    const titles = ["Coherence", "Moon", "Paddington"];
    for (const title of titles) expect(await cardButton(dialog, title)).toHaveAttribute("aria-pressed", "false");
    expect(within(dialog).getByText("Porque preferís ciencia ficción; Moon es una joya poco conocida.")).toBeInTheDocument();
    expect(within(dialog).getByText("Joya poco conocida")).toBeInTheDocument();
    expect(within(dialog).getByText("Para descubrir")).toBeInTheDocument();
    expect(within(dialog).getByText("Popular")).toBeInTheDocument();
    expect(within(dialog).getAllByLabelText(/^Puntuación/)).toHaveLength(3);
    expect(await within(dialog).findByText("Tus sorpresas: Coherence, Moon, Paddington.")).toBeInTheDocument();
  });

  it("highlights the chosen card with its next steps; «Otras 3» excludes the batch on screen", async () => {
    const hands = [FIRST, SECOND];
    const fetchMock = renderDiscover({
      "GET /recommendations": () => jsonResponse(recommendations()),
      "GET /recommendations/surprise": () => hands.shift()!(),
    });
    await userEvent.click(await screen.findByRole("button", { name: "Sorprendeme" }));
    const dialog = await screen.findByRole("dialog", { name: "Elegí tu función" });
    expect(within(dialog).queryByRole("link", { name: /Ver ficha/ })).not.toBeInTheDocument();

    await userEvent.click(await cardButton(dialog, "Moon"));

    expect(await cardButton(dialog, "Moon")).toHaveAttribute("aria-pressed", "true");
    expect(within(dialog).getByRole("link", { name: /Ver ficha/ })).toHaveAttribute("href", "/movies/21");
    expect(within(dialog).getByRole("link", { name: /Explorar universo/ })).toHaveAttribute("href", "/universe/21");

    await userEvent.click(within(dialog).getByRole("button", { name: "Otras 3" }));

    const next = await screen.findByRole("dialog", { name: "Elegí tu función" });
    expect(await cardButton(next, "Arrival")).toBeInTheDocument();
    expect(within(next).queryByText("Moon")).not.toBeInTheDocument();
    const calls = fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.includes("/surprise"));
    expect(new URL(calls[0]).searchParams.get("exclude")).toBeNull();
    expect(new URL(calls[1]).searchParams.get("exclude")).toBe("20,21,22"); // never the batch on screen
  });

  it("shows every card at once, without flipping, with reduced motion", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), media: query, addEventListener() {}, removeEventListener() {} }));
    renderDiscover({ "GET /recommendations": () => jsonResponse(recommendations()), "GET /recommendations/surprise": FIRST });

    await userEvent.click(await screen.findByRole("button", { name: "Sorprendeme" }));

    const dialog = await screen.findByRole("dialog", { name: "Elegí tu función" });
    expect(within(dialog).getByRole("button", { name: /^Coherence/ })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /^Paddington/ })).toBeInTheDocument();
  });

  it("is also in the main menu, closes with Escape and gives the focus back", async () => {
    renderDiscover({ "GET /recommendations": () => jsonResponse(recommendations()), "GET /recommendations/surprise": FIRST });
    const nav = await screen.findByRole("navigation", { name: "Principal" });
    const trigger = await within(nav).findByRole("button", { name: "Sorprendeme" });

    await userEvent.click(trigger);
    expect(await screen.findByRole("dialog", { name: "Elegí tu función" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("explains when there is nothing to suggest yet", async () => {
    renderDiscover({
      "GET /recommendations": () => jsonResponse(recommendations()),
      "GET /recommendations/surprise": () =>
        apiError(404, "NO_SURPRISE", "Todavía no tenemos una película para sorprenderte. Marcá algunas que te gusten."),
    });

    await userEvent.click(await screen.findByRole("button", { name: "Sorprendeme" }));

    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Todavía no hay sorpresas")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: /Buscar películas/ })).toHaveAttribute("href", "/search");
  });

  it("shows loading and a retry on errors", async () => {
    let fail = true;
    renderDiscover({
      "GET /recommendations": () => jsonResponse(recommendations()),
      "GET /recommendations/surprise": () => (fail ? apiError(503, "TMDB_UNAVAILABLE", "El catálogo no está disponible.") : FIRST()),
    });

    await userEvent.click(await screen.findByRole("button", { name: "Sorprendeme" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("No pudimos sorprenderte")).toBeInTheDocument();

    fail = false;
    await userEvent.click(within(dialog).getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("dialog", { name: "Elegí tu función" })).toBeInTheDocument();
  });
});
