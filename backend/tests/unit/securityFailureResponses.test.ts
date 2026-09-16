import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  login: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  isR2Configured: vi.fn(() => true),
  getPresignedUploadUrl: vi.fn(),
  uploadBufferToPresignedUrl: vi.fn(),
  validateContentType: vi.fn(() => ({ category: "image", maxBytes: 1024 })),
}));

vi.mock("../../src/services/authService", () => {
  class AuthServiceError extends Error {
    constructor(public readonly code: "NICKNAME_TAKEN" | "INVALID_CREDENTIALS") {
      super(code);
    }
  }
  return { AuthServiceError, register: mocks.register, login: mocks.login };
});

vi.mock("../../src/db/client", () => ({
  prisma: { user: { findUniqueOrThrow: mocks.findUniqueOrThrow } },
}));

vi.mock("../../src/services/uploadService", () => ({
  isR2Configured: mocks.isR2Configured,
  getPresignedUploadUrl: mocks.getPresignedUploadUrl,
  uploadBufferToPresignedUrl: mocks.uploadBufferToPresignedUrl,
  validateContentType: mocks.validateContentType,
}));

import { login, register } from "../../src/controllers/authController";
import { presign } from "../../src/controllers/uploadController";

const sensitive = "Prisma P2002 at db.internal:5432 secret-token";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isR2Configured.mockReturnValue(true);
  mocks.validateContentType.mockReturnValue({ category: "image", maxBytes: 1024 });
});

describe("security failure responses", () => {
  it("does not expose unexpected registration or login internals", async () => {
    mocks.register.mockRejectedValueOnce(new Error(sensitive));
    mocks.login.mockRejectedValueOnce(new Error(sensitive));
    const app = express();
    app.use(express.json());
    app.post("/register", register);
    app.post("/login", login);

    const registration = await request(app)
      .post("/register")
      .send({ name: "Test", nickname: "tester", password: "password123" });
    const signIn = await request(app)
      .post("/login")
      .send({ nickname: "tester", password: "password123" });

    expect(registration.status).toBe(500);
    expect(signIn.status).toBe(500);
    expect(JSON.stringify(registration.body)).not.toContain(sensitive);
    expect(JSON.stringify(signIn.body)).not.toContain(sensitive);
  });

  it("does not expose storage-provider internals", async () => {
    mocks.getPresignedUploadUrl.mockRejectedValueOnce(new Error(sensitive));
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.actor = { id: "actor-1", isAiManaged: false };
      next();
    });
    app.post("/presign", presign);

    const response = await request(app)
      .post("/presign")
      .send({ filename: "avatar.png", contentType: "image/png", kind: "avatar" });

    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body)).not.toContain(sensitive);
  });
});
