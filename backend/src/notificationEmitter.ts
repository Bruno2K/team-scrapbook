import type { Notification } from "@prisma/client";

let emitFn: ((n: Notification) => void) | null = null;

export function setNotificationEmitter(fn: (n: Notification) => void): void {
  emitFn = fn;
}

export function emitNotificationIfSet(n: Notification): void {
  if (emitFn) {
    try {
      emitFn(n);
    } catch {
      // ignore emit errors
    }
  }
}
