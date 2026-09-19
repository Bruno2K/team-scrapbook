import { log } from "./logger.js";
import {
  recordSocketAccepted,
  recordSocketDisconnect,
  recordSocketPolicyFailure,
  recordSocketRejected,
} from "./metrics.js";

export function classifyDisconnectReason(reason: string | undefined): string {
  const value = (reason ?? "").toLowerCase();
  if (value.includes("parse")) return "parse_error";
  if (value.includes("ping timeout") || value.includes("timeout")) return "timeout";
  if (value.includes("transport")) return "transport";
  if (value.includes("server")) return "server_disconnect";
  if (value.includes("client") || value === "io client disconnect") return "client_disconnect";
  return "other";
}

export function observeSocketAccepted(socketId: string): void {
  recordSocketAccepted();
  log.info({
    event: "socket.accepted",
    socketId,
    outcome: "success",
  });
}

export function observeSocketRejected(socketId: string): void {
  recordSocketRejected();
  recordSocketPolicyFailure("connection", "UNAUTHENTICATED");
  log.warn({
    event: "socket.rejected",
    socketId,
    outcome: "failure",
    failureCategory: "unknown",
  });
}

export function observeSocketDisconnect(socketId: string, reason: string | undefined): void {
  const disconnectReason = classifyDisconnectReason(reason);
  recordSocketDisconnect(disconnectReason);
  log.info({
    event: "socket.disconnect",
    socketId,
    disconnectReason,
  });
}

export function observeSocketPolicyFailure(
  socketId: string,
  eventName: "message" | "typing",
  code: "RATE_LIMITED" | "INVALID_MESSAGE" | "FORBIDDEN",
): void {
  recordSocketPolicyFailure(eventName, code);
  log.warn({
    event: "socket.policy_failure",
    socketId,
    failureCategory: code === "RATE_LIMITED" ? "rate_limited" : "unknown",
  });
}
