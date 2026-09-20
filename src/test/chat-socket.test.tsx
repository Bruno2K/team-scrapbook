import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

const connect = vi.fn();
const disconnect = vi.fn();
const removeAllListeners = vi.fn();
const on = vi.fn();
const mockSocket = {
  auth: {} as { token?: string },
  connected: false,
  on,
  connect,
  disconnect,
  removeAllListeners,
  emit: vi.fn(),
};

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => mockSocket),
}));

describe("ChatProvider socket session", () => {
  afterEach(() => {
    mockSocket.auth = {};
    mockSocket.connected = false;
    connect.mockClear();
    disconnect.mockClear();
    removeAllListeners.mockClear();
    on.mockClear();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("connects on login, updates credentials on renewal, and disconnects on logout", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_API_URL", "https://api.example.test");
    const { io } = await import("socket.io-client");
    const { ChatProvider } = await import("@/contexts/ChatContext");
    const session = await import("@/auth/session");

    function wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={new QueryClient()}>
          <ChatProvider>{children}</ChatProvider>
        </QueryClientProvider>
      );
    }

    session.completeAuthBootstrap();
    const view = render(<div>child</div>, { wrapper });
    expect(io).not.toHaveBeenCalled();

    session.setAccessToken("access-login");
    await waitFor(() => {
      expect(io).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ auth: { token: "access-login" } }),
      );
    });
    expect((io as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]).not.toHaveProperty("query");

    mockSocket.connected = true;
    session.setAccessToken("access-renewed");
    await waitFor(() => {
      expect(mockSocket.auth).toEqual({ token: "access-renewed" });
    });
    expect(io).toHaveBeenCalledTimes(1);

    mockSocket.connected = false;
    session.setAccessToken("access-reconnect");
    await waitFor(() => {
      expect(mockSocket.auth).toEqual({ token: "access-reconnect" });
      expect(connect).toHaveBeenCalled();
    });

    session.clearAccessToken();
    await waitFor(() => {
      expect(disconnect).toHaveBeenCalled();
    });
    view.unmount();
  });
});
