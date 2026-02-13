import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getFeed, getMyFeed, postFeedItem, deleteFeedItem, type PostFeedInput } from "@/api/feed";

export const FEED_QUERY_KEY = ["feed"];
export const MY_FEED_QUERY_KEY = ["feed", "me"];

export function useFeed() {
  const { data: feed = [], isLoading, error } = useQuery({
    queryKey: FEED_QUERY_KEY,
    queryFn: getFeed,
  });

  return { feed, isLoading, error };
}

export function useMyFeed() {
  const { data: feed = [], isLoading, error } = useQuery({
    queryKey: MY_FEED_QUERY_KEY,
    queryFn: getMyFeed,
  });

  return { feed, isLoading, error };
}

export function usePostFeed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PostFeedInput) => postFeedItem(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FEED_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: MY_FEED_QUERY_KEY });
    },
  });
}

export function useDeleteFeedItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteFeedItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FEED_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: MY_FEED_QUERY_KEY });
    },
  });
}
