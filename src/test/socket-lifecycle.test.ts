import { describe, expect, it } from "vitest";
import { nextSocketLifecycleAction, socketAuth } from "@/auth/socketLifecycle";

describe("socket auth lifecycle", () => {
  it("connects when a session becomes available and disconnects when it is cleared", () => {
    expect(nextSocketLifecycleAction(false, false, null)).toBe("noop");
    expect(nextSocketLifecycleAction(false, false, "access-1")).toBe("connect");
    expect(nextSocketLifecycleAction(true, true, "access-2")).toBe("update-auth");
    expect(nextSocketLifecycleAction(true, false, "access-3")).toBe("update-auth");
    expect(nextSocketLifecycleAction(true, true, null)).toBe("disconnect");
    expect(socketAuth("access-3")).toEqual({ token: "access-3" });
    expect(JSON.stringify(socketAuth("access-3"))).not.toContain("query");
  });
});
