import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getFeed, postFeedItem, type PostFeedInput } from "@/api/feed";

export const FEED_QUERY_KEY = ["feed"];

export function useFeed() {
  const { data: feed = [], isLoading, error } = useQuery({
    queryKey: FEED_QUERY_KEY,
    queryFn: getFeed,
  });

  return { feed, isLoading, error };
}

export function usePostFeed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PostFeedInput) => postFeedItem(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FEED_QUERY_KEY });
    },
  });
}
