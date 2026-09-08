import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  apiFetch,
  AUTH_EXPIRED_EVENT,
  clearAuthSession,
  getAuthExpiration,
  saveAuthSession,
} from "../api/client";
import type { components } from "../types/api.generated";

export type CurrentUser = components["schemas"]["UserRead"];
export type UserRole = CurrentUser["role"];
type TokenResponse = components["schemas"]["TokenResponse"];

interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  sessionMessage: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: CurrentUser) => void;
  refreshUser: () => Promise<CurrentUser>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  const endSession = useCallback(
    (message?: string) => {
      clearAuthSession();
      queryClient.clear();
      setUser(null);
      setExpiresAt(null);
      setSessionMessage(message ?? null);
    },
    [queryClient],
  );

  useEffect(() => {
    const handleExpiredSession = () =>
      endSession("Sua sessao expirou. Entre novamente para continuar.");
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);

    const expiration = getAuthExpiration();
    if (!expiration) {
      clearAuthSession();
      setIsLoading(false);
      return () =>
        window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);
    }
    if (expiration <= Date.now()) {
      handleExpiredSession();
      setIsLoading(false);
      return () =>
        window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);
    }

    setExpiresAt(expiration);
    apiFetch<CurrentUser>("/api/v1/auth/me")
      .then(setUser)
      .catch(() => undefined)
      .finally(() => setIsLoading(false));
    return () =>
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpiredSession);
  }, [endSession]);

  useEffect(() => {
    if (!expiresAt) return;
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      endSession("Sua sessao expirou. Entre novamente para continuar.");
      return;
    }
    const timeout = window.setTimeout(
      () => endSession("Sua sessao expirou. Entre novamente para continuar."),
      remaining,
    );
    return () => window.clearTimeout(timeout);
  }, [endSession, expiresAt]);

  const login = useCallback(
    async (email: string, password: string) => {
      setSessionMessage(null);
      const tokenResponse = await apiFetch<TokenResponse>(
        "/api/v1/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
        },
      );
      const expiration = saveAuthSession(
        tokenResponse.access_token,
        tokenResponse.expires_in,
      );
      try {
        const me = await apiFetch<CurrentUser>("/api/v1/auth/me");
        queryClient.clear();
        setUser(me);
        setExpiresAt(expiration);
      } catch (error) {
        endSession();
        throw error;
      }
    },
    [endSession, queryClient],
  );

  const logout = useCallback(() => endSession(), [endSession]);

  const updateUser = useCallback((currentUser: CurrentUser) => {
    setUser(currentUser);
  }, []);

  const refreshUser = useCallback(async () => {
    const currentUser = await apiFetch<CurrentUser>("/api/v1/auth/me");
    setUser(currentUser);
    return currentUser;
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      sessionMessage,
      login,
      logout,
      updateUser,
      refreshUser,
    }),
    [user, isLoading, sessionMessage, login, logout, updateUser, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
}
