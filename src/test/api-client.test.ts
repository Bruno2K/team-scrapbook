import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "@/api/client";

describe("API client", () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("adds the stored bearer token without discarding caller headers", async () => {
    localStorage.setItem("token", "session-token");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/health", { headers: { "X-Request-ID": "request-1" } });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/health$/),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer session-token",
          "Content-Type": "application/json",
          "X-Request-ID": "request-1",
        }),
      }),
    );
  });

  it("surfaces a JSON API error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(apiRequest("/private")).rejects.toThrow("Unauthorized");
  });

  it("falls back to the HTTP status when an error body is empty", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));

    await expect(apiRequest("/unavailable")).rejects.toThrow("HTTP 503");
  });
});
