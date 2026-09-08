const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
export const AUTH_EXPIRED_EVENT = "auth:expired";

const ACCESS_TOKEN_KEY = "access_token";
const ACCESS_TOKEN_EXPIRES_AT_KEY = "access_token_expires_at";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getToken(): string | null {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function saveAuthSession(
  accessToken: string,
  expiresIn: number,
): number {
  const expiresAt = Date.now() + expiresIn * 1000;
  sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  sessionStorage.setItem(ACCESS_TOKEN_EXPIRES_AT_KEY, String(expiresAt));
  return expiresAt;
}

export function getAuthExpiration(): number | null {
  if (!getToken()) return null;
  const value = sessionStorage.getItem(ACCESS_TOKEN_EXPIRES_AT_KEY);
  if (!value) return null;
  const expiresAt = Number(value);
  return Number.isFinite(expiresAt) ? expiresAt : null;
}

export function clearAuthSession(): void {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_EXPIRES_AT_KEY);
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!response.ok) {
    if (response.status === 401 && token) {
      clearAuthSession();
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    }
    let detail = "Erro inesperado. Tente novamente.";
    try {
      const body = await response.json();
      detail = body.detail ?? detail;
    } catch {
      // corpo sem JSON valido
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
