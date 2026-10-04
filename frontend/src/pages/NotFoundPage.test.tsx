import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppRoutes } from "@/AppRoutes";
import { jsonResponse, mockFetch } from "@/test/fetchMock";
import { renderWithProviders, TEST_USER } from "@/test/render";

describe("NotFoundPage", () => {
  it("is a space-themed 404 that leads back to Descubrir", async () => {
    mockFetch({ "GET /auth/me": () => jsonResponse(TEST_USER) });
    renderWithProviders(<AppRoutes />, { route: "/esta/ruta/no-existe", authenticated: true });

    expect(await screen.findByRole("heading", { level: 1, name: "Te perdiste en el espacio" })).toBeInTheDocument();
    expect(screen.getByText(/404/)).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Volver a Descubrir/ })).toHaveAttribute("href", "/discover");
    expect(screen.getByRole("link", { name: /Buscar películas/ })).toHaveAttribute("href", "/search");
  });

  it("without a session it leads to the login", async () => {
    renderWithProviders(<AppRoutes />, { route: "/nada" });

    expect(await screen.findByRole("link", { name: /Ir a iniciar sesión/ })).toHaveAttribute("href", "/login");
  });
});
