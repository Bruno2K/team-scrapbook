export type SocketLifecycleAction = "connect" | "disconnect" | "update-auth" | "noop";

export function nextSocketLifecycleAction(
  hasSocket: boolean,
  connected: boolean,
  accessToken: string | null,
): SocketLifecycleAction {
  if (!accessToken) return hasSocket ? "disconnect" : "noop";
  if (!hasSocket) return "connect";
  if (!connected) return "update-auth";
  return "update-auth";
}

export function socketAuth(accessToken: string): { token: string } {
  return { token: accessToken };
}
