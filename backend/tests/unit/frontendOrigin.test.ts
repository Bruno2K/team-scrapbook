import { describe, expect, it } from "vitest";
import {
  getConfiguredFrontendOrigins,
  isAllowedFrontendOrigin,
} from "../../src/platform/frontendOrigin.js";

describe("frontend origin policy", () => {
  it("allows exact configured origins and rejects missing or unknown origins", () => {
    const configured = "https://app.example, http://localhost:8080";
    expect(getConfiguredFrontendOrigins(configured)).toEqual([
      "https://app.example",
      "http://localhost:8080",
    ]);
    expect(isAllowedFrontendOrigin("https://app.example", configured)).toBe(true);
    expect(isAllowedFrontendOrigin("http://localhost:8080", configured)).toBe(true);
    expect(isAllowedFrontendOrigin("https://evil.example", configured)).toBe(false);
    expect(isAllowedFrontendOrigin(undefined, configured)).toBe(false);
    expect(isAllowedFrontendOrigin("https://app.example.evil", configured)).toBe(false);
  });

  it("never treats a wildcard as a credentialed allowed origin", () => {
    expect(getConfiguredFrontendOrigins("*")).toEqual([]);
    expect(isAllowedFrontendOrigin("https://anything.example", "*")).toBe(false);
    expect(getConfiguredFrontendOrigins("https://app.example, *")).toEqual(["https://app.example"]);
  });
});
