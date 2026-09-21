import {
  clearAccessToken,
  getAccessToken,
  publishAuthEvent,
  runExclusiveRefresh,
  setAccessToken,
} from "@/auth/session";

const baseURL = import.meta.env.VITE_API_URL ?? "";

const CREDENTIALED_AUTH_PATHS = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/logout",
]);

export function getAuthToken(): string | null {
  return getAccessToken();
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function authPathname(path: string): string {
  return normalizePath(path).split("?")[0] ?? path;
}

function isCredentialedAuthPath(path: string): boolean {
  return CREDENTIALED_AUTH_PATHS.has(authPathname(path));
}

function resolveRequestUrl(path: string): string {
  const normalized = normalizePath(path);
  if (isCredentialedAuthPath(normalized)) {
    return normalized;
  }
  return `${baseURL.replace(/\/$/, "")}${normalized}`;
}

async function parseErrorMessage(res: Response): Promise<string> {
  const body = await res.text();
  let message = body;
  try {
    const json = JSON.parse(body) as { message?: string };
    message = json.message ?? body;
  } catch {
    // use body as message
  }
  return message || `HTTP ${res.status}`;
}

async function requestAccessTokenRefresh(): Promise<string | null> {
  if (!isApiConfigured()) return null;
  try {
    const res = await fetch("/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type");
    if (!contentType?.includes("application/json")) return null;
    const data = (await res.json()) as { token?: unknown };
    return typeof data.token === "string" && data.token ? data.token : null;
  } catch {
    return null;
  }
}

export async function renewAccessToken(): Promise<string | null> {
  return runExclusiveRefresh(async () => {
    const token = await requestAccessTokenRefresh();
    if (token) {
      setAccessToken(token);
      return token;
    }
    return null;
  });
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  return apiRequestInternal(path, options, false);
}

async function apiRequestInternal<T>(
  path: string,
  options: RequestInit,
  isRetry: boolean,
): Promise<T> {
  const url = resolveRequestUrl(path);
  const credentialedAuth = isCredentialedAuthPath(path);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (!credentialedAuth) {
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: credentialedAuth ? "include" : (options.credentials ?? "omit"),
  });

  if (res.status === 401 && !credentialedAuth && !isRetry) {
    const renewed = await renewAccessToken();
    if (renewed) {
      return apiRequestInternal(path, options, true);
    }
    clearAccessToken();
    publishAuthEvent({ type: "session-invalidated" });
  }

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res));
  }

  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  return res.text() as Promise<T>;
}

export function isApiConfigured(): boolean {
  return Boolean(baseURL && baseURL !== "mock");
}
