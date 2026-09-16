import { afterEach, describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { jwtIdentityTokenCodec } from "../../src/modules/identity/integration/jwtIdentityTokenCodec.js";
import { sendMessageSchema } from "../../src/modules/messaging/index.js";
import { ProcessRateLimiter } from "../../src/platform/processRateLimiter.js";

const originalNodeEnv = process.env.NODE_ENV;
const originalJwtSecret = process.env.JWT_SECRET;

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
});

describe("identity token hardening", () => {
  it("fails production validation for a missing or placeholder secret", () => {
    process.env.NODE_ENV = "production";
    delete process.env.JWT_SECRET;
    expect(() => jwtIdentityTokenCodec.validateConfiguration()).toThrow(/JWT_SECRET/);

    process.env.JWT_SECRET = "dev-secret-change-in-production";
    expect(() => jwtIdentityTokenCodec.validateConfiguration()).toThrow(/JWT_SECRET/);
  });

  it("pins HS256 and validates identity claims", () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = "unit-test-secret";
    const wrongAlgorithm = jwt.sign({ userId: "user-1" }, "unit-test-secret", { algorithm: "HS384" });
    const missingIdentity = jwt.sign({ purpose: "access" }, "unit-test-secret", { algorithm: "HS256" });
    const inconsistentIdentity = jwt.sign(
      { userId: "user-1", purpose: "access" },
      "unit-test-secret",
      { algorithm: "HS256", subject: "user-2" },
    );

    expect(() => jwtIdentityTokenCodec.verify(wrongAlgorithm, "access")).toThrow();
    expect(() => jwtIdentityTokenCodec.verify(missingIdentity, "access")).toThrow();
    expect(() => jwtIdentityTokenCodec.verify(inconsistentIdentity, "access")).toThrow();
    const wrongPurpose = jwt.sign(
      { userId: "user-1", purpose: "steam-link" },
      "unit-test-secret",
      { algorithm: "HS256", subject: "user-1" },
    );
    expect(() => jwtIdentityTokenCodec.verify(wrongPurpose, "access")).toThrow();
  });
});

describe("shared messaging validation", () => {
  it("rejects unknown actor/system fields and oversized payloads", () => {
    expect(sendMessageSchema.safeParse({
      conversationId: "conversation-1",
      content: "hello",
      senderId: "attacker-selected",
    }).success).toBe(false);
    expect(sendMessageSchema.safeParse({
      conversationId: "conversation-1",
      content: "x".repeat(4001),
    }).success).toBe(false);
  });
});

describe("process-local rate limiter", () => {
  it("limits within a window and resets deterministically", () => {
    const limiter = new ProcessRateLimiter(1_000, 2);
    expect(limiter.consume("actor", 0).allowed).toBe(true);
    expect(limiter.consume("actor", 1).allowed).toBe(true);
    expect(limiter.consume("actor", 2)).toMatchObject({ allowed: false, retryAfterSeconds: 1 });
    expect(limiter.consume("actor", 1_001).allowed).toBe(true);
  });
});
