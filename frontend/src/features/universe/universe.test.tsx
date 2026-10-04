import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { AppRoutes } from "@/AppRoutes";
import { apiError, jsonResponse, mockFetch, pending } from "@/test/fetchMock";
import { mockReactFlow } from "@/test/reactFlow";
import { renderWithProviders, TEST_USER } from "@/test/render";

const me = () => jsonResponse(TEST_USER);

function node(id: number, title: string, year = 2010) {
  return { id, tmdb_id: 1000 + id, title, poster: null, year, score: 8.1, overview: `Sinopsis de ${title}.` };
}

function edge(source: number, target: number, type: string, label: string, strength: number, short = label.split(" por ").pop()!) {
  return { source, target, type, types: [type], label, reasons: [{ type, label, short }], strength };
}

const INTERSTELLAR = {
  center: 1,
  nodes: [node(1, "Interstellar", 2014), node(2, "Inception"), node(3, "Memento", 2000), node(4, "Gravity", 2013)],
  edges: [
    edge(1, 2, "DIRECTOR", "Dirigidas por Christopher Nolan", 1),
    edge(1, 3, "DIRECTOR", "Dirigidas por Christopher Nolan", 1),
    edge(1, 4, "SIMILAR", "Similares según TMDB", 0.8, "Similar"),
  ],
  degraded: false,
};

const INCEPTION = {
  center: 2,
  nodes: [node(2, "Inception"), node(1, "Interstellar", 2014), node(3, "Memento", 2000), node(5, "Shutter Island")],
  edges: [
    edge(2, 1, "DIRECTOR", "Dirigidas por Christopher Nolan", 1),
    edge(2, 3, "DIRECTOR", "Dirigidas por Christopher Nolan", 1),
    edge(2, 5, "ACTOR", "Ambas con Leonardo DiCaprio", 0.9, "Leonardo DiCaprio"),
  ],
  degraded: false,
};

function renderMap(routes: Parameters<typeof mockFetch>[0], route = "/universe/1") {
  const fetchMock = mockFetch({ "GET /auth/me": me, ...routes });
  renderWithProviders(<AppRoutes />, { route, authenticated: true });
  return fetchMock;
}

// The map is lazy and React Flow measures first: allow more than the default 1s under load.
const nodeButton = (name: string) => screen.findByRole("button", { name }, { timeout: 4000 });

beforeEach(() => mockReactFlow());

describe("UniversePage", () => {
  it("shows stars appearing while loading", async () => {
    renderMap({ "GET /graph/movies/1": () => pending() });

    expect(await screen.findByText("Trazando el universo…")).toBeInTheDocument();
  });

  it("renders the center, its neighbors and the legend", async () => {
    renderMap({ "GET /graph/movies/1": () => jsonResponse(INTERSTELLAR) });

    expect(await nodeButton("Interstellar (2014)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Inception (2010)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Memento (2000)" })).toBeInTheDocument();
    const legend = screen.getByRole("group", { name: "Leyenda de conexiones" });
    for (const type of ["Saga", "Universo", "Director", "Actor", "Similar", "Género"]) {
      expect(within(legend).getByText(type)).toBeInTheDocument();
    }
    expect(screen.getByRole("navigation", { name: "Recorrido" })).toHaveTextContent("Interstellar");
    expect(screen.getByText("4/50 películas")).toBeInTheDocument();
  });

  it("opens the side panel with the connection reason and actions", async () => {
    renderMap({ "GET /graph/movies/1": () => jsonResponse(INTERSTELLAR) });

    await userEvent.click(await nodeButton("Inception (2010)"));

    const panel = screen.getByRole("complementary", { name: "Detalle de Inception" });
    expect(within(panel).getByRole("heading", { name: "Inception" })).toBeInTheDocument();
    expect(within(panel).getByText("Sinopsis de Inception.")).toBeInTheDocument();
    expect(within(panel).getByLabelText("Puntuación 8.1 de 10")).toBeInTheDocument();
    expect(within(panel).getByText("Con Interstellar")).toBeInTheDocument();
    expect(within(panel).getByText("Dirigidas por Christopher Nolan")).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: /Ver ficha/ })).toHaveAttribute("href", "/movies/2");
    expect(within(panel).getByRole("button", { name: /Expandir desde acá/ })).toBeEnabled();

    await userEvent.click(within(panel).getByRole("button", { name: "Cerrar panel" }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("expands from a node: reuses existing movies, adds new ones and updates the path", async () => {
    const fetchMock = renderMap({
      "GET /graph/movies/1": () => jsonResponse(INTERSTELLAR),
      "GET /graph/movies/2": () => jsonResponse(INCEPTION),
    });

    await userEvent.click(await nodeButton("Inception (2010)"));
    await userEvent.click(screen.getByRole("button", { name: /Expandir desde acá/ }));

    expect(await nodeButton("Shutter Island (2010)")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Memento (2000)" })).toHaveLength(1); // reused
    expect(screen.getAllByRole("button", { name: "Interstellar (2014)" })).toHaveLength(1);
    expect(screen.getByText("5/50 películas")).toBeInTheDocument();
    expect(screen.getByText("1 película nueva conectadas con Inception.")).toBeInTheDocument();
    const path = screen.getByRole("navigation", { name: "Recorrido" });
    expect(within(path).getAllByRole("button").map((b) => b.textContent)).toEqual(["Interstellar", "Inception"]);
    expect(screen.getByRole("button", { name: /Centrar acá/ })).toBeInTheDocument(); // already expanded
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("/graph/movies/2"))).toHaveLength(1);

    // Memento is now connected to both: the panel lists both reasons.
    await userEvent.click(screen.getByRole("button", { name: "Memento (2000)" }));
    const panel = screen.getByRole("complementary", { name: "Detalle de Memento" });
    expect(within(panel).getByText("Con Interstellar")).toBeInTheDocument();
    expect(within(panel).getByText("Con Inception")).toBeInTheDocument();
  });

  it("goes back with the breadcrumb, recenters and clears the map", async () => {
    renderMap({
      "GET /graph/movies/1": () => jsonResponse(INTERSTELLAR),
      "GET /graph/movies/2": () => jsonResponse(INCEPTION),
    });
    await userEvent.click(await nodeButton("Inception (2010)"));
    await userEvent.click(screen.getByRole("button", { name: /Expandir desde acá/ }));
    await nodeButton("Shutter Island (2010)");
    const path = () => within(screen.getByRole("navigation", { name: "Recorrido" })).getAllByRole("button");

    await userEvent.click(path()[0]);
    expect(path().map((b) => b.textContent)).toEqual(["Interstellar"]);
    expect(screen.getByRole("complementary", { name: "Detalle de Interstellar" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Limpiar mapa" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Shutter Island (2010)" })).not.toBeInTheDocument());
    expect(screen.getByText("4/50 películas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recentrar" })).toBeInTheDocument();
  });

  it("warns at ~50 nodes, blocks expanding and offers to clean", async () => {
    const many = {
      center: 1,
      nodes: [node(1, "Interstellar", 2014), ...Array.from({ length: 50 }, (_, i) => node(100 + i, `Vecina ${i}`))],
      edges: Array.from({ length: 50 }, (_, i) => edge(1, 100 + i, "GENRE", "Comparten Drama", 0.35)),
      degraded: false,
    };
    renderMap({ "GET /graph/movies/1": () => jsonResponse(many) });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("El mapa tiene 51 películas");
    await userEvent.click(await nodeButton("Vecina 0 (2010)"));
    expect(screen.getByRole("button", { name: /Expandir desde acá/ })).toBeDisabled();
    expect(within(alert).getByRole("button", { name: "Limpiar mapa" })).toBeInTheDocument();
  });

  it("keeps the map when an expansion fails", async () => {
    renderMap({
      "GET /graph/movies/1": () => jsonResponse(INTERSTELLAR),
      "GET /graph/movies/2": () => apiError(503, "TMDB_UNAVAILABLE", "El catálogo no está disponible."),
    });

    await userEvent.click(await nodeButton("Inception (2010)"));
    await userEvent.click(screen.getByRole("button", { name: /Expandir desde acá/ }));

    expect(await screen.findByText("El catálogo no está disponible.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Memento (2000)" })).toBeInTheDocument();
    expect(screen.getByText("4/50 películas")).toBeInTheDocument();
  });

  it("tells when TMDB was degraded", async () => {
    renderMap({ "GET /graph/movies/1": () => jsonResponse({ ...INTERSTELLAR, degraded: true }) });

    expect(await screen.findByText(/TMDB no respondió del todo/)).toBeInTheDocument();
  });

  it("shows an empty state when there are no connections", async () => {
    renderMap({
      "GET /graph/movies/1": () => jsonResponse({ center: 1, nodes: [node(1, "Rara")], edges: [], degraded: false }),
    });

    expect(await screen.findByText("Todavía no hay conexiones")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Volver a la ficha/ })).toHaveAttribute("href", "/movies/1");
  });

  it("shows not found for an unknown movie", async () => {
    renderMap({ "GET /graph/movies/99": () => apiError(404, "MOVIE_NOT_FOUND", "La película no existe.") }, "/universe/99");

    expect(await screen.findByText("Película no encontrada")).toBeInTheDocument();
  });

  it("rejects invalid ids without calling the API", async () => {
    const fetchMock = renderMap({}, "/universe/abc");

    expect(await screen.findByText("Película no encontrada")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/graph/"))).toBe(false);
  });

  it("shows an error state with retry", async () => {
    let calls = 0;
    renderMap({
      "GET /graph/movies/1": () => {
        calls += 1;
        return calls === 1 ? apiError(500, "INTERNAL_ERROR", "Error interno del servidor.") : jsonResponse(INTERSTELLAR);
      },
    });

    expect(await screen.findByText("No pudimos trazar el mapa")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await nodeButton("Interstellar (2014)")).toBeInTheDocument();
  });
});

function summary(id: number, title: string) {
  return { id, tmdb_id: 1000 + id, title, release_year: 2010, poster_url: null, vote_average: 8, added_at: "2026-10-01T10:00:00Z" };
}

function savedList(...movies: ReturnType<typeof summary>[]) {
  return () => jsonResponse({ page: 1, total_pages: movies.length ? 1 : 0, total_results: movies.length, results: movies });
}

describe("UniverseStartPage", () => {
  it("is in the main menu, active on the start screen and on the map", async () => {
    renderMap({ "GET /graph/movies/1": () => jsonResponse(INTERSTELLAR) });

    const nav = screen.getByRole("navigation", { name: "Principal" });
    const item = await within(nav).findByRole("link", { name: "Universo" });
    expect(item).toHaveAttribute("href", "/universe");
    expect(item).toHaveAttribute("aria-current", "page");
    const order = within(nav).getAllByRole("link").map((link) => link.textContent);
    expect(order.indexOf("Universo")).toBe(order.indexOf("Descubrir") + 1);
    expect(order.indexOf("Mi perfil")).toBe(order.indexOf("Universo") + 1);
  });

  it("starts from the user's favorites and likes, without repeats", async () => {
    renderMap(
      {
        "GET /me/favorites": savedList(summary(1, "Interstellar"), summary(2, "Inception")),
        "GET /me/likes": savedList(summary(2, "Inception"), summary(7, "Arrival")),
      },
      "/universe",
    );

    expect(await screen.findByRole("heading", { level: 1, name: "Explorá el universo" })).toBeInTheDocument();
    const section = await screen.findByRole("region", { name: "Empezá desde tus favoritas" });
    const links = within(section).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/universe/1", "/universe/2", "/universe/7"]);
    expect(within(section).getByRole("link", { name: "Explorar el universo de Arrival" })).toBeInTheDocument();
  });

  it("suggests well-known movies when the user has no favorites or likes", async () => {
    renderMap(
      {
        "GET /me/favorites": savedList(),
        "GET /me/likes": savedList(),
        "GET /movies/onboarding-sample": () => jsonResponse({ results: [summary(40, "The Matrix"), summary(41, "Interstellar")] }),
      },
      "/universe",
    );

    const section = await screen.findByRole("region", { name: "Películas para empezar" });
    expect(await within(section).findByRole("link", { name: "Explorar el universo de The Matrix" })).toHaveAttribute(
      "href",
      "/universe/40",
    );
  });

  it("searches the starting movie and opens its map", async () => {
    renderMap(
      {
        "GET /me/favorites": savedList(),
        "GET /me/likes": savedList(),
        "GET /movies/onboarding-sample": () => jsonResponse({ results: [] }),
        "GET /movies/search": () =>
          jsonResponse({ query: "inter", page: 1, total_pages: 1, total_results: 1, results: [summary(1, "Interstellar")] }),
        "GET /graph/movies/1": () => jsonResponse(INTERSTELLAR),
      },
      "/universe",
    );

    await userEvent.type(await screen.findByRole("searchbox", { name: "Película de inicio" }), "inter");
    const results = await screen.findByRole("region", { name: "Resultados" });
    await userEvent.click(await within(results).findByRole("link", { name: "Explorar el universo de Interstellar" }));

    expect(await nodeButton("Interstellar (2014)")).toBeInTheDocument();
  });
});

describe("Map legibility", () => {
  const chipTexts = () => screen.queryAllByTestId("edge-chip").map((chip) => chip.textContent);

  it("labels each connection with a chip: the person, «Similar» or the genre", async () => {
    renderMap({ "GET /graph/movies/1": () => jsonResponse(INTERSTELLAR) });

    await nodeButton("Interstellar (2014)");
    await waitFor(() => expect(chipTexts()).toContain("Similar"));

    // Only the chips that cover no poster nor another chip show (just the name, never cut).
    expect(chipTexts().every((text) => !text?.includes("…") && !text?.includes("+"))).toBe(true);
  });

  it("the legend filters connection types and can be collapsed", async () => {
    renderMap({ "GET /graph/movies/1": () => jsonResponse(INTERSTELLAR) });
    await nodeButton("Interstellar (2014)");
    const legend = screen.getByRole("group", { name: "Leyenda de conexiones" });
    await waitFor(() => expect(chipTexts()).toContain("Similar"));

    const similar = within(legend).getByRole("button", { name: /Similar/ });
    expect(similar).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(similar);
    expect(similar).toHaveAttribute("aria-pressed", "false");
    expect(chipTexts()).not.toContain("Similar");

    await userEvent.click(similar);
    await waitFor(() => expect(chipTexts()).toContain("Similar"));

    await userEvent.click(within(legend).getByRole("button", { name: "Conexiones" }));
    expect(within(legend).queryByRole("button", { name: /Similar/ })).not.toBeInTheDocument();
  });

  it("hovering a movie keeps its connections lit and dims the rest", async () => {
    renderMap({ "GET /graph/movies/1": () => jsonResponse(INTERSTELLAR) });
    const gravity = await nodeButton("Gravity (2013)");

    await userEvent.hover(gravity);

    // Only Gravity's chip remains and the movies it is not connected to fade out.
    await waitFor(() => expect(chipTexts()).toEqual(["Similar"]));
    expect(screen.getByRole("button", { name: "Memento (2000)" }).parentElement).toHaveClass("opacity-30");
    expect(screen.getByRole("button", { name: "Interstellar (2014)" }).parentElement).not.toHaveClass("opacity-30");

    await userEvent.unhover(gravity);
    await waitFor(() => expect(screen.getByRole("button", { name: "Memento (2000)" }).parentElement).not.toHaveClass("opacity-30"));
  });
});

describe("Sagas", () => {
  const sagaNode = (id: number, title: string, year: number) => node(id, title, year);
  const GOBLET = {
    center: 1,
    nodes: [sagaNode(1, "Harry Potter y el cáliz de fuego", 2005), sagaNode(2, "Harry Potter y la piedra filosofal", 2001), node(3, "Donnie Brasco", 1997)],
    edges: [
      edge(1, 2, "SAGA", "De la saga Harry Potter", 1, "Saga Harry Potter"),
      edge(1, 3, "DIRECTOR", "Dirigidas por Mike Newell", 0.92, "Mike Newell"),
    ],
    degraded: false,
    saga: { name: "Harry Potter", total: 4 },
  };
  const FULL_SAGA = {
    center: 1,
    nodes: [
      sagaNode(1, "Harry Potter y el cáliz de fuego", 2005),
      sagaNode(2, "Harry Potter y la piedra filosofal", 2001),
      sagaNode(4, "Harry Potter y la cámara secreta", 2002),
      sagaNode(5, "Harry Potter y la Orden del Fénix", 2007),
    ],
    edges: [
      edge(1, 2, "SAGA", "De la saga Harry Potter", 1, "Saga Harry Potter"),
      edge(1, 4, "SAGA", "De la saga Harry Potter", 1, "Saga Harry Potter"),
      edge(1, 5, "SAGA", "De la saga Harry Potter", 1, "Saga Harry Potter"),
    ],
    degraded: false,
    saga: { name: "Harry Potter", total: 4 },
  };

  it("the center's panel adds the rest of its saga to the map", async () => {
    renderMap({
      "GET /graph/movies/1": () => jsonResponse(GOBLET),
      "GET /graph/movies/1/saga": () => jsonResponse(FULL_SAGA),
    });

    await userEvent.click(await nodeButton("Harry Potter y el cáliz de fuego (2005)"));
    const panel = screen.getByRole("complementary", { name: /Detalle de Harry Potter y el cáliz de fuego/ });
    await userEvent.click(within(panel).getByRole("button", { name: "Ver saga completa (4)" }));

    expect(await nodeButton("Harry Potter y la Orden del Fénix (2007)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Harry Potter y la cámara secreta (2002)" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Harry Potter y la piedra filosofal (2001)" })).toHaveLength(1);
    expect(screen.getByText("2 películas más de la saga Harry Potter.")).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /Ver saga completa/ })).not.toBeInTheDocument();
  });

  it("no saga button when the whole saga is already there or the movie has none", async () => {
    renderMap({ "GET /graph/movies/1": () => jsonResponse(INTERSTELLAR) });

    await userEvent.click(await nodeButton("Interstellar (2014)"));

    expect(screen.queryByRole("button", { name: /Ver saga completa/ })).not.toBeInTheDocument();
  });

  it("chips name the saga and their tooltip has the full reason", async () => {
    renderMap({ "GET /graph/movies/1": () => jsonResponse(GOBLET) });

    await userEvent.hover(await nodeButton("Harry Potter y la piedra filosofal (2001)"));

    await waitFor(() => expect(screen.getByTestId("edge-chip")).toHaveTextContent("Saga Harry Potter"));
    expect(screen.getByRole("tooltip")).toHaveTextContent("De la saga Harry Potter");
  });
});

describe("Minimap", () => {
  it("folds away so it never hides a movie, and comes back", async () => {
    renderMap({ "GET /graph/movies/1": () => jsonResponse(INTERSTELLAR) });
    await nodeButton("Interstellar (2014)");
    const minimap = () => document.querySelector(".react-flow__minimap");
    expect(minimap()).not.toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Ocultar minimapa" }));
    expect(minimap()).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Mostrar minimapa" }));
    expect(minimap()).not.toBeNull();
  });
});
