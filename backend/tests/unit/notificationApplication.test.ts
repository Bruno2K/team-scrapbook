import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createNotificationApplication,
  type NotificationRecord,
  type NotificationRepository,
} from "../../src/modules/notifications/application/notificationApplication";

const createdAt = new Date("2026-09-16T12:00:00.000Z");
const notification: NotificationRecord = {
  id: "notification-1",
  userId: "user-1",
  type: "FRIEND_REQUEST",
  payload: { requestId: "request-1" },
  readAt: null,
  createdAt,
};

function createRepositoryMock(): NotificationRepository {
  return {
    create: vi.fn().mockResolvedValue(notification),
    listForUser: vi.fn().mockResolvedValue([]),
    markRead: vi.fn().mockResolvedValue({ count: 1 }),
    markAllRead: vi.fn().mockResolvedValue({ count: 1 }),
    listByType: vi.fn().mockResolvedValue([]),
    deleteByIds: vi.fn().mockResolvedValue(undefined),
  };
}

describe("notification application", () => {
  let repository: NotificationRepository;

  beforeEach(() => {
    repository = createRepositoryMock();
  });

  it("persists a notification and delivers the unchanged realtime JSON shape", async () => {
    const application = createNotificationApplication(repository);
    const delivery = vi.fn();
    application.setDelivery(delivery);

    await application.create({
      userId: "user-1",
      type: "FRIEND_REQUEST",
      payload: { requestId: "request-1" },
    });

    expect(repository.create).toHaveBeenCalledWith({
      userId: "user-1",
      type: "FRIEND_REQUEST",
      payload: { requestId: "request-1" },
    });
    expect(delivery).toHaveBeenCalledWith({
      id: "notification-1",
      userId: "user-1",
      type: "FRIEND_REQUEST",
      payload: { requestId: "request-1" },
      readAt: null,
      createdAt: "2026-09-16T12:00:00.000Z",
    });
  });

  it("keeps realtime delivery best-effort after persistence succeeds", async () => {
    const application = createNotificationApplication(repository);
    application.setDelivery(() => {
      throw new Error("socket unavailable");
    });

    await expect(
      application.create({
        userId: "user-1",
        type: "FRIEND_REQUEST",
        payload: { requestId: "request-1" },
      })
    ).resolves.toEqual(notification);
  });

  it("preserves cursor pagination by requesting one extra item", async () => {
    const extra = { ...notification, id: "notification-2" };
    vi.mocked(repository.listForUser).mockResolvedValue([notification, extra]);
    const application = createNotificationApplication(repository);

    const result = await application.listForUser({ userId: "user-1", limit: 1 });

    expect(repository.listForUser).toHaveBeenCalledWith({ userId: "user-1", limit: 1 });
    expect(result).toEqual({ items: [notification], nextCursor: "notification-2" });
  });

  it("deletes only notifications for the handled community join request", async () => {
    vi.mocked(repository.listByType).mockResolvedValue([
      {
        ...notification,
        id: "matching",
        type: "COMMUNITY_JOIN_REQUEST",
        payload: { joinRequestId: "join-1", communityId: "community-1", userId: "user-1" },
      },
      {
        ...notification,
        id: "other",
        type: "COMMUNITY_JOIN_REQUEST",
        payload: { joinRequestId: "join-2", communityId: "community-1", userId: "user-2" },
      },
    ]);
    const application = createNotificationApplication(repository);

    await application.deleteByJoinRequestId("join-1");

    expect(repository.deleteByIds).toHaveBeenCalledWith(["matching"]);
  });
});
