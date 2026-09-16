import { describe, expect, it } from "vitest";
import { checkArchitecture, findArchitectureViolations } from "../../scripts/checkArchitecture";

describe("modular-monolith architecture guard", () => {
  it("accepts the checked-in source dependency paths", async () => {
    await expect(checkArchitecture()).resolves.toEqual([]);
  });

  it("rejects a controlled cross-module internal import", () => {
    const violations = findArchitectureViolations({
      "src/modules/chat/application/sendMessage.ts":
        'import { prismaNotificationRepository } from "../../notifications/persistence/prismaNotificationRepository.js";',
    });

    expect(violations).toEqual([
      expect.objectContaining({
        file: "src/modules/chat/application/sendMessage.ts",
        rule: expect.stringContaining("imports internal file of module 'notifications'"),
      }),
    ]);
  });

  it("rejects Prisma access from module application code", () => {
    const violations = findArchitectureViolations({
      "src/modules/notifications/application/createNotification.ts":
        'import { prisma } from "../../../db/client.js";',
    });

    expect(violations).toEqual([
      expect.objectContaining({
        rule: "Prisma access inside a module belongs in its persistence adapter",
      }),
    ]);
  });
});
