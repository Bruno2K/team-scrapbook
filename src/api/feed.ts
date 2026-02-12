import type { FeedItem } from "@/lib/types";
import { apiRequest, isApiConfigured } from "./client";
import { MOCK_FEED } from "@/lib/mockData";

export async function getFeed(): Promise<FeedItem[]> {
  if (!isApiConfigured()) {
    return MOCK_FEED;
  }
  try {
    return await apiRequest<FeedItem[]>("/feed");
  } catch {
    return MOCK_FEED;
  }
}

export interface PostFeedInput {
  content: string;
  type?: "post" | "achievement" | "community" | "scrap";
}

export async function postFeedItem(input: PostFeedInput): Promise<FeedItem> {
  return apiRequest<FeedItem>("/feed", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
