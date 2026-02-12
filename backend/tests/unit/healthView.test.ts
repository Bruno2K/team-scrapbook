import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { healthToJSON } from "../../src/views/healthView";

describe("healthView", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-02-12T12:00:00.000Z"));
  });

  it("returns status ok and service name", () => {
    const result = healthToJSON();

    expect(result).toEqual({
      status: "ok",
      service: "team-scrapbook-api",
      timestamp: "2025-02-12T12:00:00.000Z",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});

