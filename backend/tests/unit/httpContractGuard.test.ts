import { describe, expect, it } from "vitest";
import {
  DOCUMENTATION_SURFACE_EXCLUSIONS,
  applyExclusions,
  extractOpenApiHttpOperations,
  findHttpContractDrift,
  formatHttpContractDrift,
  hasHttpContractDrift,
  joinHttpPaths,
  mountPathFromLayer,
  normalizeHttpPath,
  operationKey,
} from "../../scripts/httpContract";
import { checkHttpContract } from "../../scripts/checkHttpContract";

describe("HTTP contract path normalization", () => {
  it("treats Express :id and OpenAPI {id} as the same path", () => {
    expect(normalizeHttpPath("/users/:userId/friends")).toBe("/users/{userId}/friends");
    expect(normalizeHttpPath("/users/{userId}/friends")).toBe("/users/{userId}/friends");
    expect(operationKey({ method: "GET", path: "/feed/:id" })).toBe("GET /feed/{id}");
  });

  it("joins mounted router prefixes with nested route paths", () => {
    expect(joinHttpPaths("/users", "/me/notifications")).toBe("/users/me/notifications");
    expect(joinHttpPaths("/health", "/")).toBe("/health");
    expect(joinHttpPaths("/health", "/ready")).toBe("/health/ready");
    expect(joinHttpPaths("", "/metrics")).toBe("/metrics");
  });

  it("reconstructs Express 4 mount prefixes from layer regexps", () => {
    expect(mountPathFromLayer({ regexp: /^\/health\/?(?=\/|$)/i })).toBe("/health");
    expect(mountPathFromLayer({ regexp: /^\/api-docs\/?(?=\/|$)/i })).toBe("/api-docs");
    expect(mountPathFromLayer({ regexp: /^\/?(?=\/|$)/i })).toBe("");
  });
});

describe("HTTP contract drift comparison", () => {
  it("reports runtime operations missing from OpenAPI", () => {
    const drift = findHttpContractDrift({
      runtime: [{ method: "post", path: "/ai-actions/generate" }],
      openApi: [],
      exclusions: [],
    });
    expect(drift.missingInOpenApi.map(operationKey)).toEqual(["POST /ai-actions/generate"]);
    expect(formatHttpContractDrift(drift)).toContain("missing in OpenAPI:");
    expect(formatHttpContractDrift(drift)).toContain("POST /ai-actions/generate");
  });

  it("reports OpenAPI operations missing from runtime", () => {
    const drift = findHttpContractDrift({
      runtime: [],
      openApi: [{ method: "get", path: "/legacy" }],
      exclusions: [],
    });
    expect(drift.missingInRuntime.map(operationKey)).toEqual(["GET /legacy"]);
    expect(formatHttpContractDrift(drift)).toContain("missing in runtime:");
  });

  it("excludes documentation surfaces instead of treating them as product routes", () => {
    const runtime = [
      { method: "get", path: "/feed" },
      { method: "get", path: "/api-docs.json" },
      { method: "get", path: "/api-docs/swagger-ui.css" },
    ];
    const product = applyExclusions(runtime, DOCUMENTATION_SURFACE_EXCLUSIONS);
    expect(product.map(operationKey)).toEqual(["GET /feed"]);
  });

  it("does not let documentation exclusions hide product mounts", () => {
    const drift = findHttpContractDrift({
      runtime: [{ method: "get", path: "/users/me" }],
      openApi: [],
      exclusions: DOCUMENTATION_SURFACE_EXCLUSIONS,
      nonRouteMounts: ["/api-docs"],
    });
    expect(drift.missingInOpenApi.map(operationKey)).toEqual(["GET /users/me"]);
  });

  it("flags an exclusion that matches nothing", () => {
    const drift = findHttpContractDrift({
      runtime: [{ method: "get", path: "/health" }],
      openApi: [{ method: "get", path: "/health" }],
      exclusions: [
        {
          id: "imaginary",
          rationale: "should not exist",
          matches: (operation) => operation.path === "/not-a-real-mount",
        },
      ],
    });
    expect(drift.invalidExclusions).toEqual([
      expect.objectContaining({ id: "imaginary" }),
    ]);
    expect(formatHttpContractDrift(drift)).toContain("invalid exclusion:");
    expect(hasHttpContractDrift(drift)).toBe(true);
  });

  it("extracts HTTP methods from an OpenAPI document without copying the document into the assertion", () => {
    const operations = extractOpenApiHttpOperations({
      paths: {
        "/feed": { get: { summary: "list" }, post: { summary: "create" } },
        "/feed/{id}": { get: { summary: "one" } },
      },
    });
    expect(operations.map(operationKey)).toEqual(["GET /feed", "GET /feed/{id}", "POST /feed"]);
  });
});

describe("composed HTTP contract guard", () => {
  it("finds no structural drift between the Express app and checked-in OpenAPI", () => {
    const result = checkHttpContract();
    if (hasHttpContractDrift(result.drift)) {
      expect.fail(formatHttpContractDrift(result.drift));
    }
    expect(result.nonRouteMounts).toContain("/api-docs");
    const productRuntime = applyExclusions(result.runtime, result.exclusions);
    const productOpenApi = applyExclusions(result.openApi, result.exclusions);
    expect(productOpenApi).toHaveLength(productRuntime.length);
    expect(productRuntime.length).toBeGreaterThan(60);
  });
});
