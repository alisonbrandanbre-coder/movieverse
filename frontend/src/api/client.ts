import { session } from "@/features/auth/session";
import type { ApiErrorBody } from "@/types/api";

const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ApiErrorBody["error"]["details"];

  constructor(status: number, code: string, message: string, details?: ApiErrorBody["error"]["details"]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type QueryValue = string | number | undefined | null;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  params?: Record<string, QueryValue>;
  /** Attach the access token and try to refresh it on 401. Defaults to true. */
  auth?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, params?: Record<string, QueryValue>): string {
  const url = new URL(`${API_URL}${path.startsWith("/") ? path : `/${path}`}`);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === "object" && value !== null && "error" in value;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  if (response.ok) return data as T;
  if (isApiErrorBody(data)) {
    throw new ApiError(response.status, data.error.code, data.error.message, data.error.details);
  }
  throw new ApiError(response.status, "HTTP_ERROR", "Ocurrió un error inesperado.");
}

async function send(path: string, options: RequestOptions, accessToken: string | null): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  try {
    return await fetch(buildUrl(path, options.params), {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "NETWORK_ERROR", "No se pudo conectar con el servidor.");
  }
}

// Single-flight refresh: concurrent 401s share one refresh request.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = session.getRefreshToken();
  if (!refresh) return null;
  refreshPromise ??= (async () => {
    try {
      const response = await send("/auth/refresh", { method: "POST", body: { refresh } }, null);
      if (!response.ok) return null;
      const tokens = (await response.json()) as { access: string; refresh?: string };
      session.setTokens({ access: tokens.access, refresh: tokens.refresh ?? refresh });
      return tokens.access;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const useAuth = options.auth ?? true;
  let response = await send(path, options, useAuth ? session.getAccessToken() : null);

  if (response.status === 401 && useAuth && session.hasSession()) {
    const newAccess = await refreshAccessToken();
    if (!newAccess) {
      session.clear();
      throw new ApiError(401, "SESSION_EXPIRED", "Tu sesión expiró. Iniciá sesión nuevamente.");
    }
    response = await send(path, options, newAccess);
  }

  return parseResponse<T>(response);
}

export function getErrorMessage(error: unknown, fallback = "Ocurrió un error inesperado."): string {
  if (error instanceof ApiError) return error.message || fallback;
  return fallback;
}
