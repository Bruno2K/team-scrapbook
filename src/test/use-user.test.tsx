import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { CURRENT_USER } from "@/lib/mockData";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("current-user resolution", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("does not fabricate CURRENT_USER when the API is configured and identity resolution fails", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_API_URL", "https://api.example.test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    ));
    const session = await import("@/auth/session");
    session.setAccessToken("expired-session");
    session.completeAuthBootstrap();
    const { useUser } = await import("@/hooks/useUser");
    const { result } = renderHook(() => useUser(), { wrapper });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.user).toBeNull();
    expect(result.current.user?.id).not.toBe(CURRENT_USER.id);
  });
});
