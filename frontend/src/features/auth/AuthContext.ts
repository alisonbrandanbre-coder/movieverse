import { createContext } from "react";

import type { AuthStatus, Credentials, User } from "@/types/auth";

export interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  login: (credentials: Credentials) => Promise<User>;
  register: (credentials: Credentials) => Promise<User>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
