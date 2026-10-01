import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRoutes } from "@/AppRoutes";
import { apiError, jsonResponse, mockFetch } from "@/test/fetchMock";
import { renderWithProviders, TEST_USER } from "@/test/render";

import { session } from "./session";

describe("LoginPage", () => {
  it("renders the login form", () => {
    mockFetch({});
    renderWithProviders(<AppRoutes />, { route: "/login" });

    expect(screen.getByRole("heading", { name: "Iniciar sesión" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeEnabled();
  });

  it("validates fields before calling the API", async () => {
    const fetchMock = mockFetch({});
    renderWithProviders(<AppRoutes />, { route: "/login" });

    await userEvent.type(screen.getByLabelText("Email"), "no-es-email");
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByText("Ingresá un email válido")).toBeInTheDocument();
    expect(screen.getByText("Ingresá tu contraseña")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the API error on wrong credentials", async () => {
    mockFetch({
      "POST /auth/login": () => apiError(401, "AUTHENTICATION_FAILED", "Email o contraseña incorrectos."),
    });
    renderWithProviders(<AppRoutes />, { route: "/login" });

    await userEvent.type(screen.getByLabelText("Email"), "ana@example.com");
    await userEvent.type(screen.getByLabelText("Contraseña"), "incorrecta");
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email o contraseña incorrectos.");
    expect(session.hasSession()).toBe(false);
  });

  it("stores the session and redirects to discover on success", async () => {
    mockFetch({
      "POST /auth/login": () => jsonResponse({ access: "a", refresh: "r", user: TEST_USER }),
    });
    renderWithProviders(<AppRoutes />, { route: "/login" });

    await userEvent.type(screen.getByLabelText("Email"), "ana@example.com");
    await userEvent.type(screen.getByLabelText("Contraseña"), "Cinefilo-2026!");
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("heading", { name: "Descubrir" })).toBeInTheDocument();
    expect(session.getAccessToken()).toBe("a");
    expect(session.getRefreshToken()).toBe("r");
  });
});

describe("RegisterPage", () => {
  it("requires matching passwords", async () => {
    const fetchMock = mockFetch({});
    renderWithProviders(<AppRoutes />, { route: "/register" });

    await userEvent.type(screen.getByLabelText("Email"), "nuevo@example.com");
    await userEvent.type(screen.getByLabelText("Contraseña"), "Cinefilo-2026!");
    await userEvent.type(screen.getByLabelText("Repetir contraseña"), "otra-cosa-123");
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByText("Las contraseñas no coinciden")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a duplicated email error from the API", async () => {
    mockFetch({
      "POST /auth/register": () => apiError(409, "EMAIL_ALREADY_REGISTERED", "Ya existe una cuenta con ese email."),
    });
    renderWithProviders(<AppRoutes />, { route: "/register" });

    await userEvent.type(screen.getByLabelText("Email"), "ana@example.com");
    await userEvent.type(screen.getByLabelText("Contraseña"), "Cinefilo-2026!");
    await userEvent.type(screen.getByLabelText("Repetir contraseña"), "Cinefilo-2026!");
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ya existe una cuenta con ese email.");
  });
});

describe("ProtectedRoute", () => {
  it("redirects anonymous users to login", async () => {
    mockFetch({});
    renderWithProviders(<AppRoutes />, { route: "/profile" });

    expect(await screen.findByRole("heading", { name: "Iniciar sesión" })).toBeInTheDocument();
  });

  it("renders the private page when the session is valid", async () => {
    mockFetch({ "GET /auth/me": () => jsonResponse(TEST_USER) });
    renderWithProviders(<AppRoutes />, { route: "/profile", authenticated: true });

    expect(await screen.findByRole("heading", { name: "Mi perfil" })).toBeInTheDocument();
    expect(screen.getByText(TEST_USER.email)).toBeInTheDocument();
  });

  it("refreshes an expired access token once and retries", async () => {
    let meCalls = 0;
    mockFetch({
      "GET /auth/me": (_url, init) => {
        meCalls += 1;
        const auth = new Headers(init?.headers).get("Authorization");
        return auth === "Bearer fresh" ? jsonResponse(TEST_USER) : apiError(401, "TOKEN_INVALID", "expired");
      },
      "POST /auth/refresh": () => jsonResponse({ access: "fresh", refresh: "rotated" }),
    });
    renderWithProviders(<AppRoutes />, { route: "/profile", authenticated: true });

    expect(await screen.findByRole("heading", { name: "Mi perfil" })).toBeInTheDocument();
    expect(meCalls).toBe(2);
    expect(session.getRefreshToken()).toBe("rotated");
  });

  it("clears the session and redirects when the refresh token is invalid", async () => {
    mockFetch({
      "GET /auth/me": () => apiError(401, "TOKEN_INVALID", "expired"),
      "POST /auth/refresh": () => apiError(401, "TOKEN_INVALID", "expired"),
    });
    renderWithProviders(<AppRoutes />, { route: "/profile", authenticated: true });

    expect(await screen.findByRole("heading", { name: "Iniciar sesión" })).toBeInTheDocument();
    await waitFor(() => expect(session.hasSession()).toBe(false));
  });
});
