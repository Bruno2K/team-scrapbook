import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_CHANNEL_NAME,
  clearAccessToken,
  completeAuthBootstrap,
  getAccessToken,
  getAuthStatus,
  publishAuthEvent,
  resetAuthSessionForTests,
  runExclusiveRefresh,
  setAccessToken,
  subscribeAuthEvents,
} from "@/auth/session";
import {
  bootstrapAuthSession,
  clearStoredToken,
  getCurrentUserId,
  getStoredToken,
  logout,
  setStoredToken,
} from "@/api/auth";

function tokenFor(payload: object): string {
  const encoded = btoa(JSON.stringify(payload)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `header.${encoded}.signature`;
}

describe("in-memory auth session", () => {
  afterEach(() => {
    localStorage.clear();
    resetAuthSessionForTests();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("does not persist ordinary access tokens in localStorage", async () => {
    setStoredToken("token-value");
    expect(getStoredToken()).toBe("token-value");
    expect(getAccessToken()).toBe("token-value");
    expect(localStorage.getItem("token")).toBeNull();

    await logout();
    expect(getStoredToken()).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("deletes and ignores legacy localStorage.token during bootstrap", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    localStorage.setItem("token", "legacy-access-token");
    expect(getAccessToken()).toBeNull();
    await bootstrapAuthSession();
    expect(localStorage.getItem("token")).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(getAuthStatus()).toBe("unauthenticated");
  });

  it("exposes an explicit bootstrap loading state before refresh completes", async () => {
    expect(getAuthStatus()).toBe("bootstrapping");
    completeAuthBootstrap();
    expect(getAuthStatus()).toBe("unauthenticated");
    setAccessToken("access");
    expect(getAuthStatus()).toBe("authenticated");
    clearAccessToken();
    expect(getAuthStatus()).toBe("unauthenticated");
  });

  it("reads userId and sub claims used by the UI from memory", () => {
    setStoredToken(tokenFor({ userId: "user-1" }));
    expect(getCurrentUserId()).toBe("user-1");
    setStoredToken(tokenFor({ sub: "user-2" }));
    expect(getCurrentUserId()).toBe("user-2");
  });

  it("treats absent or malformed tokens as unauthenticated", () => {
    expect(getCurrentUserId()).toBeNull();
    setStoredToken("not-a-jwt");
    expect(getCurrentUserId()).toBeNull();
    clearStoredToken();
  });

  it("never transports credentials through BroadcastChannel", () => {
    const posted: unknown[] = [];
    class FakeChannel {
      readonly name: string;
      onmessage: ((event: MessageEvent) => void) | null = null;
      constructor(name: string) {
        this.name = name;
      }
      postMessage(data: unknown) {
        posted.push(data);
      }
      close() {}
    }
    vi.stubGlobal("BroadcastChannel", FakeChannel);

    const received: unknown[] = [];
    const unsubscribe = subscribeAuthEvents((event) => received.push(event));
    publishAuthEvent({ type: "logout" });
    publishAuthEvent({ type: "session-invalidated" });
    publishAuthEvent({ type: "session-refreshed" });
    unsubscribe();

    expect(posted.length).toBeGreaterThan(0);
    expect(
      posted.every((payload) => payload && typeof payload === "object" && Object.keys(payload as object).join() === "type"),
    ).toBe(true);
    expect(JSON.stringify(posted)).not.toContain("token");
    expect(JSON.stringify(received)).not.toContain("access-secret");
    expect(AUTH_CHANNEL_NAME).toBe("team-scrapbook-auth");
  });

  it("bootstraps from a successful refresh and treats a failed refresh as unauthenticated", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_API_URL", "https://api.example.test");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "boot-token" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Sessão inválida ou expirada" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);
    const session = await import("@/auth/session");
    const auth = await import("@/api/auth");
    await expect(auth.bootstrapAuthSession()).resolves.toBe("authenticated");
    expect(session.getAccessToken()).toBe("boot-token");
    expect(localStorage.getItem("token")).toBeNull();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/auth/refresh");
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain("api.example.test");
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      method: "POST",
      credentials: "include",
    }));

    session.resetAuthSessionForTests();
    await expect(auth.bootstrapAuthSession()).resolves.toBe("unauthenticated");
    expect(session.getAccessToken()).toBeNull();
    expect(session.getAuthStatus()).toBe("unauthenticated");
  });

  it("shares a single in-flight refresh across concurrent callers", async () => {
    let starts = 0;
    const factory = () => {
      starts += 1;
      return Promise.resolve("renewed");
    };
    const [first, second] = await Promise.all([runExclusiveRefresh(factory), runExclusiveRefresh(factory)]);
    expect(first).toBe("renewed");
    expect(second).toBe("renewed");
    expect(starts).toBe(1);
  });
});
