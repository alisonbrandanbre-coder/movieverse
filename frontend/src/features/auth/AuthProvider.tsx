import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import type { AuthStatus, Credentials, User } from "@/types/auth";

import { authKeys, fetchMe, loginRequest, logoutRequest, registerRequest } from "./api";
import { AuthContext, type AuthContextValue } from "./AuthContext";
import { session } from "./session";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [hasSession, setHasSession] = useState(session.hasSession);

  // React to session changes coming from anywhere (e.g. a failed token refresh).
  useEffect(() => session.subscribe(() => setHasSession(session.hasSession())), []);

  const meQuery = useQuery({
    queryKey: authKeys.me,
    queryFn: fetchMe,
    enabled: hasSession,
    retry: false,
    staleTime: 5 * 60_000,
  });

  let status: AuthStatus = "anonymous";
  if (hasSession && meQuery.isPending) status = "loading";
  else if (hasSession && meQuery.isSuccess) status = "authenticated";

  const login = useCallback(
    async (credentials: Credentials) => {
      const { access, refresh, user } = await loginRequest(credentials);
      queryClient.setQueryData(authKeys.me, user);
      session.setTokens({ access, refresh });
      return user;
    },
    [queryClient],
  );

  const register = useCallback(
    async (credentials: Credentials) => {
      await registerRequest(credentials);
      return login(credentials);
    },
    [login],
  );

  const logout = useCallback(async () => {
    const refresh = session.getRefreshToken();
    if (refresh) {
      // Best effort: the local session is cleared even if the server call fails.
      await logoutRequest(refresh).catch(() => undefined);
    }
    session.clear();
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: status === "authenticated" ? (meQuery.data as User) : null,
      status,
      login,
      register,
      logout,
    }),
    [status, meQuery.data, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
