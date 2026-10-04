import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRoutes } from "@/AppRoutes";
import { apiError, jsonResponse, mockFetch } from "@/test/fetchMock";
import { INTERSTELLAR_CREDITS_DTO, INTERSTELLAR_DETAIL_DTO, INTERSTELLAR_SUMMARY_DTO } from "@/test/movieFixtures";
import { renderWithProviders, TEST_USER } from "@/test/render";
import { DEMO_PREFERENCES_DTO, interactionState, OPTIONS_DTO, savedPage } from "@/test/userFixtures";

const me = () => jsonResponse(TEST_USER);

function action(name: string) {
  return screen.getByRole("button", { name });
}

describe("Movie detail actions", () => {
  function setup(initial = interactionState(), routes = {}) {
    const calls: string[] = [];
    let state = initial;
    mockFetch({
      "GET /auth/me": me,
      "GET /movies/1": () => jsonResponse(INTERSTELLAR_DETAIL_DTO),
      "GET /movies/1/credits": () => jsonResponse(INTERSTELLAR_CREDITS_DTO),
      "GET /movies/1/interactions": () => jsonResponse(state),
      "POST /movies/1/interactions": (_url, init) => {
        const { type } = JSON.parse(String(init?.body)) as { type: string };
        calls.push(`POST ${type}`);
        state = {
          ...state,
          ...(type === "FAVORITE" && { favorite: true }),
          ...(type === "WATCHLIST" && { watchlist: true }),
          ...(type === "WATCHED" && { watched: true, watchlist: false }),
          ...((type === "LIKE" || type === "DISLIKE") && { reaction: type as "LIKE" | "DISLIKE" }),
        };
        return jsonResponse(state);
      },
      "DELETE /movies/1/interactions/FAVORITE": () => {
        calls.push("DELETE FAVORITE");
        state = { ...state, favorite: false };
        return jsonResponse(state);
      },
      ...routes,
    });
    renderWithProviders(<AppRoutes />, { route: "/movies/1", authenticated: true });
    return calls;
  }

  it("shows the five actions with the user's current state", async () => {
    setup(interactionState({ favorite: true, reaction: "DISLIKE" }));

    await waitFor(() => expect(action("Favorita")).toHaveAttribute("aria-pressed", "true"));
    expect(action("Pendiente")).toHaveAttribute("aria-pressed", "false");
    expect(action("Vista")).toHaveAttribute("aria-pressed", "false");
    expect(action("Me gusta")).toHaveAttribute("aria-pressed", "false");
    expect(action("No me interesa")).toHaveAttribute("aria-pressed", "true");
  });

  it("adds to the watchlist with visible feedback", async () => {
    const calls = setup();
    await waitFor(() => expect(action("Pendiente")).toBeEnabled());

    await userEvent.click(action("Pendiente"));

    expect(action("Pendiente")).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByRole("status")).toHaveTextContent("Agregada a pendientes.");
    expect(calls).toEqual(["POST WATCHLIST"]);
  });

  it("turns an active action off with DELETE", async () => {
    const calls = setup(interactionState({ favorite: true }));
    await waitFor(() => expect(action("Favorita")).toHaveAttribute("aria-pressed", "true"));

    await userEvent.click(action("Favorita"));

    await waitFor(() => expect(action("Favorita")).toHaveAttribute("aria-pressed", "false"));
    expect(screen.getByRole("status")).toHaveTextContent("Quitada de favoritas.");
    expect(calls).toEqual(["DELETE FAVORITE"]);
  });

  it("reflects the server side effects (watched removes it from the watchlist)", async () => {
    setup(interactionState({ watchlist: true }));
    await waitFor(() => expect(action("Pendiente")).toHaveAttribute("aria-pressed", "true"));

    await userEvent.click(action("Vista"));

    expect(await screen.findByText("Marcada como vista y quitada de pendientes.")).toBeInTheDocument();
    expect(action("Vista")).toHaveAttribute("aria-pressed", "true");
    expect(action("Pendiente")).toHaveAttribute("aria-pressed", "false");
  });

  it("rolls back and explains when saving fails", async () => {
    setup(interactionState(), {
      "POST /movies/1/interactions": () => apiError(500, "INTERNAL_ERROR", "Error interno del servidor."),
    });
    await waitFor(() => expect(action("Me gusta")).toBeEnabled());

    await userEvent.click(action("Me gusta"));

    expect(await screen.findByText("Error interno del servidor.")).toBeInTheDocument();
    expect(action("Me gusta")).toHaveAttribute("aria-pressed", "false");
  });
});

describe("ProfilePage", () => {
  const SAVED_INTERSTELLAR = { ...INTERSTELLAR_SUMMARY_DTO, added_at: "2026-10-04T10:00:00Z" };

  it("shows tabs with counters and an empty state per list", async () => {
    mockFetch({
      "GET /auth/me": me,
      "GET /me/favorites": () => jsonResponse(savedPage([SAVED_INTERSTELLAR])),
      "GET /me/watchlist": () => jsonResponse(savedPage()),
      "GET /me/watched": () => jsonResponse(savedPage()),
    });
    renderWithProviders(<AppRoutes />, { route: "/profile", authenticated: true });

    const favorites = await screen.findByRole("tab", { name: /Favoritas/ });
    expect(favorites).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(favorites).toHaveTextContent("1"));
    expect(await screen.findByRole("link", { name: /Interstellar/ })).toHaveAttribute("href", "/movies/1");

    await userEvent.click(screen.getByRole("tab", { name: /Pendientes/ }));
    expect(await screen.findByText("No tenés pendientes")).toBeInTheDocument();

    // Keyboard: → moves to the next tab.
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /Vistas/ })).toHaveFocus();
    expect(await screen.findByText("No marcaste películas vistas")).toBeInTheDocument();
  });

  it("opens the tab from the URL and removes a movie from the watchlist", async () => {
    let watchlist = [SAVED_INTERSTELLAR];
    let deleted = false;
    mockFetch({
      "GET /auth/me": me,
      "GET /me/favorites": () => jsonResponse(savedPage()),
      "GET /me/watchlist": () => jsonResponse(savedPage(watchlist)),
      "GET /me/watched": () => jsonResponse(savedPage()),
      "DELETE /movies/1/interactions/WATCHLIST": () => {
        deleted = true;
        watchlist = [];
        return jsonResponse(interactionState());
      },
    });
    renderWithProviders(<AppRoutes />, { route: "/profile?tab=pendientes", authenticated: true });

    await userEvent.click(await screen.findByRole("button", { name: "Quitar Interstellar de pendientes" }));

    expect(await screen.findByText("No tenés pendientes")).toBeInTheDocument();
    expect(deleted).toBe(true);
  });

  it("shows an empty favorites state with a call to action", async () => {
    mockFetch({
      "GET /auth/me": me,
      "GET /me/favorites": () => jsonResponse(savedPage()),
      "GET /me/watchlist": () => jsonResponse(savedPage()),
      "GET /me/watched": () => jsonResponse(savedPage()),
    });
    renderWithProviders(<AppRoutes />, { route: "/profile", authenticated: true });

    expect(await screen.findByText("Todavía no tenés favoritas")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Buscar películas/ })).toHaveAttribute("href", "/search");
  });

  it("edits and saves the preferences", async () => {
    let sent: unknown = null;
    mockFetch({
      "GET /auth/me": me,
      "GET /me/favorites": () => jsonResponse(savedPage()),
      "GET /me/watchlist": () => jsonResponse(savedPage()),
      "GET /me/watched": () => jsonResponse(savedPage()),
      "GET /preferences": () => jsonResponse(DEMO_PREFERENCES_DTO),
      "GET /preferences/options": () => jsonResponse(OPTIONS_DTO),
      "PUT /preferences": (_url, init) => {
        sent = JSON.parse(String(init?.body));
        return jsonResponse({ ...DEMO_PREFERENCES_DTO, discovery_level: "FAMILIAR" });
      },
    });
    renderWithProviders(<AppRoutes />, { route: "/profile?tab=preferencias", authenticated: true });

    // Current preferences are pre-selected.
    expect(await screen.findByRole("button", { name: "Ciencia ficción", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terror", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Años 90", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Explorador/ })).toBeChecked();

    await userEvent.click(screen.getByRole("button", { name: "Años 2000" }));
    await userEvent.click(screen.getByRole("radio", { name: /Familiar/ }));
    await userEvent.click(screen.getByRole("button", { name: /Guardar cambios/ }));

    expect(await screen.findByText("Preferencias guardadas.")).toBeInTheDocument();
    expect(sent).toEqual({
      preferred_genres: [15, 17],
      disliked_genres: [11],
      preferred_decades: [1990],
      preferred_languages: ["en"],
      discovery_level: "FAMILIAR",
    });
  });

  it("does not allow saving without a favorite genre", async () => {
    mockFetch({
      "GET /auth/me": me,
      "GET /me/favorites": () => jsonResponse(savedPage()),
      "GET /me/watchlist": () => jsonResponse(savedPage()),
      "GET /me/watched": () => jsonResponse(savedPage()),
      "GET /preferences": () => jsonResponse(DEMO_PREFERENCES_DTO),
      "GET /preferences/options": () => jsonResponse(OPTIONS_DTO),
    });
    renderWithProviders(<AppRoutes />, { route: "/profile?tab=preferencias", authenticated: true });

    await userEvent.click(await screen.findByRole("button", { name: "Ciencia ficción", pressed: true }));
    await userEvent.click(screen.getByRole("button", { name: "Suspense", pressed: true }));

    expect(screen.getByRole("button", { name: /Guardar cambios/ })).toBeDisabled();
    expect(screen.getByText("Elegí al menos un género favorito.")).toBeInTheDocument();
  });
});
