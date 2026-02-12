import { CURRENT_USER } from "@/lib/mockData";
import { useMemo } from "react";
import type { User } from "@/lib/types";

export function useUser() {
  const user = useMemo<User>(() => CURRENT_USER, []);
  return { user, isLoading: false };
}
