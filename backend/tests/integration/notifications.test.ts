import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/app";
import { prisma } from "../../src/db/client";

describe("notification HTTP adapter", () => {
  const nickname = `notifications_${Date.now()}`;
  const otherNickname = `notifications_other_${Date.now()}`;
  let token: string;
  let userId: string;
  let notificationId: string;
  let otherNotificationId: string;

  beforeAll(async () => {
    const registration = await request(app).post("/auth/register").send({
      name: "Notification User",
      nickname,
      password: "password123",
    });
    token = registration.body.token;
    userId = registration.body.user.id;
    const notification = await prisma.notification.create({
      data: {
        userId,
        type: "FRIEND_REQUEST",
        payload: { requestId: "request-1" },
      },
    });
    notificationId = notification.id;

    const otherRegistration = await request(app).post("/auth/register").send({
      name: "Other Notification User",
      nickname: otherNickname,
      password: "password123",
    });
    const otherNotification = await prisma.notification.create({
      data: {
        userId: otherRegistration.body.user.id,
        type: "FRIEND_REQUEST",
        payload: { requestId: "request-other" },
      },
    });
    otherNotificationId = otherNotification.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { nickname: { in: [nickname, otherNickname] } } });
  });

  it("preserves authentication and notification response shape", async () => {
    const unauthorized = await request(app).get("/users/me/notifications");
    expect(unauthorized.status).toBe(401);

    const response = await request(app)
      .get("/users/me/notifications?unreadOnly=true&limit=1")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      items: [
        expect.objectContaining({
          id: notificationId,
          userId,
          type: "FRIEND_REQUEST",
          payload: { requestId: "request-1" },
          readAt: null,
        }),
      ],
    });
  });

  it("marks only the authenticated user's notification as read", async () => {
    const response = await request(app)
      .patch(`/users/me/notifications/${notificationId}/read`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Marcada como lida" });
    await expect(
      prisma.notification.findUnique({ where: { id: notificationId }, select: { readAt: true } })
    ).resolves.toEqual({ readAt: expect.any(Date) });
  });

  it("does not mark another user's notification as read", async () => {
    const response = await request(app)
      .patch(`/users/me/notifications/${otherNotificationId}/read`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Notificação não encontrada" });
    await expect(
      prisma.notification.findUnique({
        where: { id: otherNotificationId },
        select: { readAt: true },
      })
    ).resolves.toEqual({ readAt: null });
  });
});
