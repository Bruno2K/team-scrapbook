import { useSyncExternalStore } from "react";
import { getAccessToken, getAuthStatus, subscribeAuth } from "@/auth/session";

export function useAccessToken(): string | null {
  return useSyncExternalStore(subscribeAuth, getAccessToken, getAccessToken);
}

export function useAuthStatus() {
  return useSyncExternalStore(subscribeAuth, getAuthStatus, getAuthStatus);
}
