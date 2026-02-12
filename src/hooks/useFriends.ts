import { useQuery } from "@tanstack/react-query";
import { getFriends } from "@/api/friends";

export const FRIENDS_QUERY_KEY = ["friends"];

export function useFriends() {
  const { data: friends = [], isLoading, error } = useQuery({
    queryKey: FRIENDS_QUERY_KEY,
    queryFn: getFriends,
  });

  const onlineFriends = friends.filter((f) => f.online);
  const offlineFriends = friends.filter((f) => !f.online);

  return { friends, onlineFriends, offlineFriends, isLoading, error };
}
