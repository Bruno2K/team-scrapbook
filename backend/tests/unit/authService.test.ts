import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../../src/db/client", () => ({
  prisma: {
    user: {
      findUnique: mocks.findUnique,
      create: mocks.create,
      update: mocks.update,
    },
  },
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed"),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

import { register, login } from "../../src/services/authService";

describe("authService", () => {
  beforeEach(() => {
    mocks.findUnique.mockReset();
    mocks.create.mockReset();
    mocks.update.mockReset();
  });

  describe("register", () => {
    it("creates user and returns user + token when nickname is free", async () => {
      mocks.findUnique.mockResolvedValue(null);
      mocks.create.mockResolvedValue({
        id: "cuid1",
        name: "Foo",
        nickname: "foo",
        team: "RED",
        mainClass: "Scout",
        level: 1,
        avatar: null,
        online: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        passwordHash: "hashed",
      });

      const result = await register({
        name: "Foo",
        nickname: "foo",
        password: "secret123",
      });

      expect(mocks.findUnique).toHaveBeenCalledWith({ where: { nickname: "foo" } });
      expect(mocks.create).toHaveBeenCalledWith({
        data: {
          name: "Foo",
          nickname: "foo",
          passwordHash: "hashed",
          team: "RED",
          mainClass: "Scout",
        },
      });
      expect(result.user.nickname).toBe("foo");
      expect(result.user.name).toBe("Foo");
      expect(result).toHaveProperty("token");
      expect(typeof result.token).toBe("string");
    });

    it("throws when nickname is already taken", async () => {
      mocks.findUnique.mockResolvedValue({ id: "existing" });

      await expect(
        register({ name: "Foo", nickname: "taken", password: "secret123" })
      ).rejects.toThrow("Nickname já em uso");

      expect(mocks.create).not.toHaveBeenCalled();
    });
  });

  describe("login", () => {
    it("returns user + token when password matches", async () => {
      mocks.findUnique.mockResolvedValue({
        id: "cuid1",
        name: "Foo",
        nickname: "foo",
        passwordHash: "hashed",
        team: "RED",
        mainClass: "Scout",
        level: 1,
        avatar: null,
        online: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mocks.update.mockResolvedValue({});

      const result = await login({ nickname: "foo", password: "secret" });

      expect(mocks.findUnique).toHaveBeenCalledWith({ where: { nickname: "foo" } });
      expect(result.user.nickname).toBe("foo");
      expect(result).toHaveProperty("token");
    });

    it("throws when user not found", async () => {
      mocks.findUnique.mockResolvedValue(null);

      await expect(login({ nickname: "missing", password: "any" })).rejects.toThrow(
        "Nickname ou senha inválidos"
      );
    });
  });
});
