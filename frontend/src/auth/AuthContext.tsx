import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "../api/client";

export type UserRole = "EMPLOYEE" | "TECHNICIAN";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  account_locked: boolean;
}

interface AuthContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem("access_token");
    if (!token) {
      setIsLoading(false);
      return;
    }

    apiFetch<CurrentUser>("/api/v1/auth/me")
      .then(setUser)
      .catch(() => sessionStorage.removeItem("access_token"))
      .finally(() => setIsLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const tokenResponse = await apiFetch<{ access_token: string }>(
      "/api/v1/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
    );
    sessionStorage.setItem("access_token", tokenResponse.access_token);
    const me = await apiFetch<CurrentUser>("/api/v1/auth/me");
    setUser(me);
  }

  function logout() {
    sessionStorage.removeItem("access_token");
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, isLoading, login, logout }),
    [user, isLoading],
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
