const baseURL = import.meta.env.VITE_API_URL ?? "";

export function getAuthToken(): string | null {
  return localStorage.getItem("token");
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${baseURL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const token = getAuthToken();
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const body = await res.text();
    let message = body;
    try {
      const json = JSON.parse(body) as { message?: string };
      message = json.message ?? body;
    } catch {
      // use body as message
    }
    throw new Error(message || `HTTP ${res.status}`);
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
