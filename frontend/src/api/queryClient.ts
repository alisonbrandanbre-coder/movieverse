import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "./client";

function shouldRetry(failureCount: number, error: unknown): boolean {
  // Client errors (4xx) will not succeed on retry.
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 1;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, staleTime: 60_000, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}
