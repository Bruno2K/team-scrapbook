import { afterEach, describe, expect, it, vi } from "vitest";

describe("API client", () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function loadClient() {
    vi.stubEnv("VITE_API_URL", "https://api.example.test");
    const session = await import("@/auth/session");
    session.resetAuthSessionForTests();
    const client = await import("@/api/client");
    return { session, client };
  }

  it("adds the in-memory bearer token without discarding caller headers or writing localStorage", async () => {
    const { session, client } = await loadClient();
    session.setAccessToken("session-token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await client.apiRequest("/health", { headers: { "X-Request-ID": "request-1" } });

    expect(localStorage.getItem("token")).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/health",
      expect.objectContaining({
        credentials: "omit",
        headers: expect.objectContaining({
          Authorization: "Bearer session-token",
          "Content-Type": "application/json",
          "X-Request-ID": "request-1",
        }),
      }),
    );
  });

  it("retries a product 401 once through a shared same-origin refresh and then uses the new bearer", async () => {
    const { session, client } = await loadClient();
    session.setAccessToken("expired-token");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: "fresh-token" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(client.apiRequest("/users/me")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/auth/refresh");
    expect(String(fetchMock.mock.calls[1]?.[0])).not.toContain("api.example.test");
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(expect.objectContaining({
      method: "POST",
      credentials: "include",
    }));
    expect((fetchMock.mock.calls[1]?.[1] as { headers?: Record<string, string> }).headers?.Authorization).toBeUndefined();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.example.test/users/me");
    expect(fetchMock.mock.calls[2]?.[0]).toBe("https://api.example.test/users/me");
    expect(fetchMock.mock.calls[2]?.[1]).toEqual(expect.objectContaining({
      credentials: "omit",
      headers: expect.objectContaining({ Authorization: "Bearer fresh-token" }),
    }));
  });

  it("does not launch a refresh storm when concurrent requests get 401", async () => {
    const { session, client } = await loadClient();
    session.setAccessToken("expired-token");
    let refreshCalls = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/auth/refresh")) {
        refreshCalls += 1;
        return new Response(JSON.stringify({ token: "fresh-token" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (refreshCalls === 0) {
        return new Response(JSON.stringify({ message: "Unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([client.apiRequest("/users/me"), client.apiRequest("/users/friends")]);
    expect(refreshCalls).toBe(1);
  });

  it("sends cookies on login/register/logout and omits bearer on those paths", async () => {
    const { session, client } = await loadClient();
    session.setAccessToken("session-token");
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url) === "/auth/logout") {
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify({ user: { id: "1" }, token: "access" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await client.apiRequest("/auth/login", { method: "POST", body: JSON.stringify({ nickname: "a", password: "b" }) });
    await client.apiRequest("/auth/register", { method: "POST", body: JSON.stringify({ name: "A", nickname: "a", password: "bbbbbb" }) });
    await client.apiRequest("/auth/logout", { method: "POST" });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/auth/login");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/auth/register");
    expect(fetchMock.mock.calls[2]?.[0]).toBe("/auth/logout");
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).not.toContain("api.example.test");
      expect(call[1]).toEqual(expect.objectContaining({ credentials: "include" }));
      expect((call[1] as { headers: Record<string, string> }).headers.Authorization).toBeUndefined();
    }
  });

  it("renews the access token from the frontend origin without sending the bearer", async () => {
    const { session, client } = await loadClient();
    session.setAccessToken("session-token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ token: "fresh-token" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(client.renewAccessToken()).resolves.toBe("fresh-token");
    expect(fetchMock).toHaveBeenCalledWith(
      "/auth/refresh",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as { headers?: Record<string, string> }).headers?.Authorization).toBeUndefined();
    expect(session.getAccessToken()).toBe("fresh-token");
  });

  it("surfaces a JSON API error message", async () => {
    const { client } = await loadClient();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(client.apiRequest("/private")).rejects.toThrow("Unauthorized");
  });

  it("falls back to the HTTP status when an error body is empty", async () => {
    const { client } = await loadClient();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));

    await expect(client.apiRequest("/unavailable")).rejects.toThrow("HTTP 503");
  });
});
