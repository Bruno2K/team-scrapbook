import type { Notification } from "@prisma/client";

export interface NotificationJSON {
  id: string;
  userId: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export function notificationToJSON(n: Notification): NotificationJSON {
  const payload = typeof n.payload === "object" && n.payload !== null
    ? (n.payload as Record<string, unknown>)
    : {};
  return {
    id: n.id,
    userId: n.userId,
    type: n.type,
    payload,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}
