import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/app";

describe("HTTP contract surfaces", () => {
  it("GET /api-docs.json returns an OpenAPI document with paths", async () => {
    const res = await request(app).get("/api-docs.json");
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\./);
    expect(res.body.paths).toBeTypeOf("object");
    expect(Object.keys(res.body.paths).length).toBeGreaterThan(20);
    expect(res.body.paths["/feed"]).toBeDefined();
    expect(res.body.paths["/ai-actions/generate"]).toBeDefined();
  });

  it("GET /users/me/steam/callback without link_token redirects to the SPA error contract", async () => {
    const res = await request(app).get("/users/me/steam/callback");
    expect(res.status).toBe(302);
    const location = res.headers.location as string;
    expect(location).toContain("/settings?");
    expect(location).toContain("steam_link=error");
    expect(location).toMatch(/message=/);
  });

  it("GET /users/me/steam/callback with an invalid link_token redirects without calling Steam as a JSON API", async () => {
    const res = await request(app).get("/users/me/steam/callback").query({ link_token: "not-a-purpose-token" });
    expect(res.status).toBe(302);
    const location = res.headers.location as string;
    expect(location).toContain("steam_link=error");
  });

  it("GET /chat/conversations requires bearer authentication", async () => {
    const res = await request(app).get("/chat/conversations");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("message");
  });
});
