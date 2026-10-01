import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";

import { AuthProvider } from "@/features/auth/AuthProvider";
import { session } from "@/features/auth/session";

interface RenderOptions {
  route?: string;
  authenticated?: boolean;
}

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
}

/** Render with the same providers as the real app (QueryClient + Auth + Router). */
export function renderWithProviders(ui: ReactElement, { route = "/", authenticated = false }: RenderOptions = {}) {
  if (authenticated) session.setTokens({ access: "test-access", refresh: "test-refresh" });
  const queryClient = createTestQueryClient();
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    ),
  };
}

export const TEST_USER = { id: 1, email: "ana@example.com" };
