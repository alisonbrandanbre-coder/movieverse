import { apiRequest } from "@/api/client";
import type { Credentials, LoginResponse, User } from "@/types/auth";

export const authKeys = {
  me: ["auth", "me"] as const,
};

export function loginRequest(credentials: Credentials): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/auth/login", { method: "POST", body: credentials, auth: false });
}

export function registerRequest(credentials: Credentials): Promise<User> {
  return apiRequest<User>("/auth/register", { method: "POST", body: credentials, auth: false });
}

export function logoutRequest(refresh: string): Promise<void> {
  return apiRequest<void>("/auth/logout", { method: "POST", body: { refresh } });
}

export function fetchMe(): Promise<User> {
  return apiRequest<User>("/auth/me");
}
