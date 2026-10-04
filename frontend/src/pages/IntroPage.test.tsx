import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppRoutes } from "@/AppRoutes";
import { jsonResponse, mockFetch } from "@/test/fetchMock";
import { renderWithProviders, TEST_USER } from "@/test/render";

describe("IntroPage", () => {
  it("plays on the first visit and can be skipped to login", async () => {
    mockFetch({});
    renderWithProviders(<AppRoutes />, { route: "/" });

    expect(screen.getByRole("region", { name: "Introducción de MovieVerse" })).toHaveTextContent(
      "Cada película es una estrella.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Saltar intro" }));
    expect(await screen.findByRole("heading", { name: "Iniciá sesión" })).toBeInTheDocument();
  });

  it("is shown only once per session", async () => {
    mockFetch({});
    window.sessionStorage.setItem("mv:intro-seen", "1");
    renderWithProviders(<AppRoutes />, { route: "/" });

    expect(await screen.findByRole("heading", { name: "Iniciá sesión" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Introducción de MovieVerse" })).not.toBeInTheDocument();
  });

  it("sends users with a session to the Home", async () => {
    mockFetch({ "GET /auth/me": () => jsonResponse(TEST_USER) });
    renderWithProviders(<AppRoutes />, { route: "/", authenticated: true });

    await userEvent.click(screen.getByRole("button", { name: "Saltar intro" }));
    expect(await screen.findByRole("heading", { name: "Inicio de MovieVerse" })).toBeInTheDocument();
  });
});
