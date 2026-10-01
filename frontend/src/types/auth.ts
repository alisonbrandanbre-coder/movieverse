export interface User {
  id: number;
  email: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}

export type AuthStatus = "loading" | "authenticated" | "anonymous";
