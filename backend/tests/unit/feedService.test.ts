import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  create: vi.fn(),
}));

vi.mock("../../src/db/client", () => ({
  prisma: {
    feedItem: {
      findMany: mocks.findMany,
      create: mocks.create,
    },
  },
}));

import { listFeed, createPost } from "../../src/services/feedService";

describe("feedService", () => {
  beforeEach(() => {
    mocks.findMany.mockReset();
    mocks.create.mockReset();
  });

  describe("listFeed", () => {
    it("returns feed items ordered by createdAt desc with user included", async () => {
      const mockItems = [
        {
          id: "f1",
          userId: "u1",
          content: "Test post",
          type: "post",
          createdAt: new Date(),
          user: { id: "u1", name: "User", nickname: "user" },
        },
      ];
      mocks.findMany.mockResolvedValue(mockItems);

      const result = await listFeed();

      expect(mocks.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: true },
      });
      expect(result).toEqual(mockItems);
    });

    it("accepts custom limit", async () => {
      mocks.findMany.mockResolvedValue([]);
      await listFeed(10);
      expect(mocks.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      );
    });
  });

  describe("createPost", () => {
    it("creates post with userId, content and default type post", async () => {
      const created = {
        id: "f1",
        userId: "u1",
        content: "Hello",
        type: "post",
        createdAt: new Date(),
        user: {},
      };
      mocks.create.mockResolvedValue(created);

      const result = await createPost({ userId: "u1", content: "Hello" });

      expect(mocks.create).toHaveBeenCalledWith({
        data: {
          userId: "u1",
          content: "Hello",
          type: "post",
        },
        include: { user: true },
      });
      expect(result).toEqual(created);
    });

    it("creates post with explicit type", async () => {
      mocks.create.mockResolvedValue({});
      await createPost({
        userId: "u1",
        content: "Achievement!",
        type: "achievement",
      });
      expect(mocks.create).toHaveBeenCalledWith({
        data: {
          userId: "u1",
          content: "Achievement!",
          type: "achievement",
        },
        include: { user: true },
      });
    });
  });
});
