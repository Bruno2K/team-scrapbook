import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("chat HTTP idempotency", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_API_URL", "https://api.example.test");
    localStorage.setItem("token", "session-token");
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reuses a caller-owned key without leaking it into the strict JSON body", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("response lost"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "message-1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);
    const { sendMessage } = await import("@/api/chat");
    const logicalAttempt = {
      conversationId: "conversation-1",
      content: "retry me",
      type: "TEXT" as const,
      idempotencyKey: "logical-attempt-1",
    };

    await expect(sendMessage(logicalAttempt)).resolves.toBeNull();
    await expect(sendMessage(logicalAttempt)).resolves.toEqual({ id: "message-1" });

    for (const [, options] of fetchMock.mock.calls) {
      expect(options).toEqual(expect.objectContaining({
        headers: expect.objectContaining({ "Idempotency-Key": "logical-attempt-1" }),
        body: JSON.stringify({
          conversationId: "conversation-1",
          content: "retry me",
          type: "TEXT",
        }),
      }));
    }
  });
});
