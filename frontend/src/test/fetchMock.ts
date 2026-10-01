import { vi } from "vitest";

type Handler = (url: URL, init?: RequestInit) => Response | Promise<Response>;

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function apiError(status: number, code: string, message: string): Response {
  return jsonResponse({ error: { code, message } }, status);
}

/**
 * Stub global fetch with handlers keyed by "METHOD /path" (path relative to /api/v1).
 * Unmatched requests fail loudly with a 404 envelope.
 */
export function mockFetch(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const key = `${init?.method ?? "GET"} ${url.pathname.replace(/^\/api\/v1/, "")}`;
    const handler = routes[key];
    if (!handler) return apiError(404, "NO_MOCK", `No mock for ${key}`);
    return handler(url, init);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** A response that never resolves, to assert loading states. */
export function pending(): Promise<Response> {
  return new Promise<Response>(() => undefined);
}
