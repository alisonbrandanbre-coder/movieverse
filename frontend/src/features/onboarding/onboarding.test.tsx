import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRoutes } from "@/AppRoutes";
import { apiError, jsonResponse, mockFetch } from "@/test/fetchMock";
import { renderWithProviders, TEST_USER } from "@/test/render";
import { DEMO_PREFERENCES_DTO, OPTIONS_DTO, PENDING_PREFERENCES_DTO, SAMPLE_DTO } from "@/test/userFixtures";

const me = () => jsonResponse(TEST_USER);

function pressed(name: string | RegExp) {
  return screen.getByRole("button", { name, pressed: true });
}

async function next() {
  await userEvent.click(screen.getByRole("button", { name: /Siguiente/ }));
}

describe("Onboarding routing", () => {
  it("sends a newly registered user to the onboarding", async () => {
    mockFetch({
      "POST /auth/register": () => jsonResponse(TEST_USER, 201),
      "POST /auth/login": () => jsonResponse({ access: "a", refresh: "r", user: TEST_USER }),
      "GET /preferences": () => jsonResponse(PENDING_PREFERENCES_DTO),
      "GET /preferences/options": () => jsonResponse(OPTIONS_DTO),
    });
    renderWithProviders(<AppRoutes />, { route: "/register" });

    await userEvent.type(screen.getByLabelText("Email"), "nuevo@example.com");
    await userEvent.type(screen.getByLabelText("Contraseña"), "Cinefilo-2026!");
    await userEvent.type(screen.getByLabelText("Repetir contraseña"), "Cinefilo-2026!");
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Armá tu constelación" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 2, name: "¿Qué géneros te encantan?" })).toBeInTheDocument();
  });

  it("redirects Discover to the onboarding while it is pending", async () => {
    mockFetch({
      "GET /auth/me": me,
      "GET /preferences": () => jsonResponse(PENDING_PREFERENCES_DTO),
      "GET /preferences/options": () => jsonResponse(OPTIONS_DTO),
    });
    renderWithProviders(<AppRoutes />, { route: "/discover", authenticated: true });

    expect(await screen.findByRole("heading", { level: 1, name: "Armá tu constelación" })).toBeInTheDocument();
  });

  it("sends users who completed it to Discover", async () => {
    mockFetch({ "GET /auth/me": me, "GET /preferences": () => jsonResponse(DEMO_PREFERENCES_DTO) });
    renderWithProviders(<AppRoutes />, { route: "/onboarding", authenticated: true });

    expect(await screen.findByRole("heading", { level: 1, name: "Descubrir" })).toBeInTheDocument();
  });

  it("logs in a returning user straight into Discover", async () => {
    mockFetch({
      "POST /auth/login": () => jsonResponse({ access: "a", refresh: "r", user: TEST_USER }),
      "GET /preferences": () => jsonResponse(DEMO_PREFERENCES_DTO),
    });
    renderWithProviders(<AppRoutes />, { route: "/login" });

    await userEvent.type(screen.getByLabelText("Email"), "ana@example.com");
    await userEvent.type(screen.getByLabelText("Contraseña"), "Cinefilo-2026!");
    await userEvent.click(screen.getByRole("button", { name: "Entrar al universo" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Descubrir" })).toBeInTheDocument();
  });
});

describe("OnboardingWizard", () => {
  function setup() {
    let submitted: unknown = null;
    let sampleUrl: URL | null = null;
    let preferences: unknown = PENDING_PREFERENCES_DTO;
    const fetchMock = mockFetch({
      "GET /auth/me": me,
      "GET /preferences": () => jsonResponse(preferences),
      "GET /preferences/options": () => jsonResponse(OPTIONS_DTO),
      "GET /movies/onboarding-sample": (url) => {
        sampleUrl = url;
        return jsonResponse(SAMPLE_DTO);
      },
      "POST /preferences/onboarding": (_url, init) => {
        submitted = JSON.parse(String(init?.body));
        preferences = DEMO_PREFERENCES_DTO;
        return jsonResponse(DEMO_PREFERENCES_DTO);
      },
    });
    renderWithProviders(<AppRoutes />, { route: "/onboarding", authenticated: true });
    return { fetchMock, submitted: () => submitted, sampleUrl: () => sampleUrl };
  }

  it("walks the six steps with progress, back/next and saves everything", async () => {
    const { submitted, sampleUrl } = setup();

    // 1. Favorite genres: required.
    await screen.findByRole("heading", { level: 2, name: "¿Qué géneros te encantan?" });
    const progress = screen.getByRole("progressbar", { name: "Progreso del onboarding" });
    expect(progress).toHaveAttribute("aria-valuenow", "1");
    expect(progress).toHaveAttribute("aria-valuetext", "Paso 1 de 6");
    expect(screen.getByRole("button", { name: /Atrás/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Siguiente/ })).toBeDisabled();
    expect(screen.getByText("Elegí al menos un género para continuar.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ciencia ficción" }));
    await userEvent.click(screen.getByRole("button", { name: "Suspense" }));
    expect(pressed("Ciencia ficción")).toBeInTheDocument();
    await next();

    // 2. Genres to avoid: favorites are not offered.
    expect(await screen.findByRole("heading", { level: 2, name: "¿Qué preferís evitar?" })).toHaveFocus();
    expect(progress).toHaveAttribute("aria-valuenow", "2");
    const avoidGroup = screen.getByRole("group", { name: "Géneros a evitar" });
    expect(within(avoidGroup).queryByRole("button", { name: "Ciencia ficción" })).not.toBeInTheDocument();
    await userEvent.click(within(avoidGroup).getByRole("button", { name: "Terror" }));

    // Back keeps what was chosen.
    await userEvent.click(screen.getByRole("button", { name: /Atrás/ }));
    expect(await screen.findByRole("heading", { level: 2, name: "¿Qué géneros te encantan?" })).toBeInTheDocument();
    expect(pressed("Ciencia ficción")).toBeInTheDocument();
    await next();
    expect(pressed("Terror")).toBeInTheDocument();
    await next();

    // 3. Decades.
    await screen.findByRole("heading", { level: 2, name: "¿Qué épocas te atraen?" });
    await userEvent.click(screen.getByRole("button", { name: "Años 90" }));
    await userEvent.click(screen.getByRole("button", { name: "Años 2000" }));
    await next();

    // 4. Languages.
    await screen.findByRole("heading", { level: 2, name: "¿En qué idiomas?" });
    await userEvent.click(screen.getByRole("button", { name: "Inglés" }));
    await next();

    // 5. Discovery level: Equilibrado by default.
    await screen.findByRole("heading", { level: 2, name: "¿Cuánto querés explorar?" });
    expect(screen.getByRole("radio", { name: /Equilibrado/ })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: /Explorador/ }));
    expect(screen.getByRole("radio", { name: /Explorador/ })).toBeChecked();
    await next();

    // 6. Quick rating, based on the genres chosen so far.
    await screen.findByRole("heading", { level: 2, name: "Valorá algunos títulos" });
    expect(progress).toHaveAttribute("aria-valuenow", "6");
    await userEvent.click(await screen.findByRole("button", { name: "Me gusta Interstellar" }));
    await userEvent.click(screen.getByRole("button", { name: "No me interesa Inception" }));
    await userEvent.click(screen.getByRole("button", { name: "Me gusta Inception" }));
    expect(screen.getByRole("button", { name: "Me gusta Inception", pressed: true })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No me interesa Inception", pressed: false })).toBeInTheDocument();
    expect(sampleUrl()?.searchParams.get("genres")).toBe("15,17");
    expect(sampleUrl()?.searchParams.get("avoid")).toBe("11");

    await userEvent.click(screen.getByRole("button", { name: /Terminar/ }));

    expect(await screen.findByRole("heading", { level: 1, name: "Descubrir" })).toBeInTheDocument();
    expect(submitted()).toEqual({
      preferred_genres: [15, 17],
      disliked_genres: [11],
      preferred_decades: [1990, 2000],
      preferred_languages: ["en"],
      discovery_level: "EXPLORER",
      ratings: [
        { movie_id: 1, reaction: "LIKE" },
        { movie_id: 3, reaction: "LIKE" },
      ],
    });
  });

  it("choosing a disliked genre as favorite removes it from the avoid list", async () => {
    setup();
    await userEvent.click(await screen.findByRole("button", { name: "Drama" }));
    await next();
    await userEvent.click(await screen.findByRole("button", { name: "Comedia" }));
    await userEvent.click(screen.getByRole("button", { name: /Atrás/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Comedia" }));
    await next();

    expect(screen.queryByRole("button", { name: "Comedia" })).not.toBeInTheDocument();
  });

  it("shows the API error and stays on the last step", async () => {
    mockFetch({
      "GET /auth/me": me,
      "GET /preferences": () => jsonResponse(PENDING_PREFERENCES_DTO),
      "GET /preferences/options": () => jsonResponse(OPTIONS_DTO),
      "GET /movies/onboarding-sample": () => jsonResponse({ results: [] }),
      "POST /preferences/onboarding": () => apiError(500, "INTERNAL_ERROR", "Error interno del servidor."),
    });
    renderWithProviders(<AppRoutes />, { route: "/onboarding", authenticated: true });

    await userEvent.click(await screen.findByRole("button", { name: "Drama" }));
    for (let i = 0; i < 5; i += 1) await next();
    expect(await screen.findByText("No hay títulos para valorar")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Terminar/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Error interno del servidor.");
    expect(screen.getByRole("heading", { level: 2, name: "Valorá algunos títulos" })).toBeInTheDocument();
  });

  it("shows an error state when the options cannot be loaded", async () => {
    mockFetch({
      "GET /auth/me": me,
      "GET /preferences": () => jsonResponse(PENDING_PREFERENCES_DTO),
      "GET /preferences/options": () => apiError(503, "TMDB_UNAVAILABLE", "Catálogo no disponible."),
    });
    renderWithProviders(<AppRoutes />, { route: "/onboarding", authenticated: true });

    await waitFor(() => expect(screen.getByText("No pudimos cargar las opciones")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});
