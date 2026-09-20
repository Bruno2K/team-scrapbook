import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { bootstrapAuthSession, recoverSessionFromCookie } from "@/api/auth";
import {
  clearAccessToken,
  subscribeAuthEvents,
} from "@/auth/session";

export function AuthBootstrap({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    void bootstrapAuthSession();
  }, []);

  useEffect(() => {
    return subscribeAuthEvents((event) => {
      if (event.type === "logout" || event.type === "session-invalidated") {
        clearAccessToken();
        queryClient.clear();
      }
      if (event.type === "session-refreshed") {
        queryClient.removeQueries({ queryKey: ["users", "me"] });
        void recoverSessionFromCookie();
      }
    });
  }, [queryClient]);

  return <>{children}</>;
}
