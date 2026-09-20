export const AUTH_CHANNEL_NAME = "team-scrapbook-auth";
export const LEGACY_ACCESS_TOKEN_STORAGE_KEY = "token";

export type AuthBootstrapState = "pending" | "ready";
export type AuthStatus = "bootstrapping" | "authenticated" | "unauthenticated";
export type AuthEventType = "logout" | "session-invalidated" | "session-refreshed";
export interface AuthEvent {
  type: AuthEventType;
}

type Listener = () => void;

let accessToken: string | null = null;
let bootstrapState: AuthBootstrapState = "pending";
let refreshInFlight: Promise<string | null> | null = null;
const listeners = new Set<Listener>();
const eventListeners = new Set<(event: AuthEvent) => void>();
let channel: BroadcastChannel | null = null;

function notify(): void {
  for (const listener of listeners) listener();
}

function ensureChannel(): BroadcastChannel | null {
  if (channel) return channel;
  if (typeof BroadcastChannel === "undefined") return null;
  channel = new BroadcastChannel(AUTH_CHANNEL_NAME);
  channel.onmessage = (message: MessageEvent<unknown>) => {
    const data = message.data;
    if (!data || typeof data !== "object" || !("type" in data)) return;
    const type = (data as { type?: unknown }).type;
    if (type !== "logout" && type !== "session-invalidated" && type !== "session-refreshed") return;
    const event: AuthEvent = { type };
    for (const listener of eventListeners) listener(event);
  };
  return channel;
}

export function subscribeAuth(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function subscribeAuthEvents(listener: (event: AuthEvent) => void): () => void {
  ensureChannel();
  eventListeners.add(listener);
  return () => {
    eventListeners.delete(listener);
  };
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  notify();
}

export function clearAccessToken(): void {
  accessToken = null;
  notify();
}

export function getBootstrapState(): AuthBootstrapState {
  return bootstrapState;
}

export function completeAuthBootstrap(): void {
  bootstrapState = "ready";
  notify();
}

export function getAuthStatus(): AuthStatus {
  if (bootstrapState !== "ready") return "bootstrapping";
  return accessToken ? "authenticated" : "unauthenticated";
}

export function discardLegacyAccessTokenStorage(): void {
  try {
    window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_STORAGE_KEY);
  } catch {
    // Storage may be unavailable; ignore rather than blocking bootstrap.
  }
}

export function publishAuthEvent(event: AuthEvent): void {
  const payload: AuthEvent = { type: event.type };
  // session-refreshed is for other tabs only; the publishing tab already has a new access token.
  if (event.type !== "session-refreshed") {
    for (const listener of eventListeners) listener(payload);
  }
  ensureChannel()?.postMessage(payload);
}

export function runExclusiveRefresh(factory: () => Promise<string | null>): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = factory().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export function resetAuthSessionForTests(): void {
  accessToken = null;
  bootstrapState = "pending";
  refreshInFlight = null;
  channel?.close();
  channel = null;
  listeners.clear();
  eventListeners.clear();
}
