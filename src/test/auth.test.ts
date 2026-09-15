import { afterEach, describe, expect, it } from "vitest";
import {
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

describe("auth session storage", () => {
  afterEach(() => localStorage.clear());

  it("stores and clears the session token", () => {
    setStoredToken("token-value");
    expect(getStoredToken()).toBe("token-value");

    logout();
    expect(getStoredToken()).toBeNull();
  });

  it("reads userId and sub claims used by the UI", () => {
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
});
