import type { FeedItem, PostComment } from "@/lib/types";
import { apiRequest, isApiConfigured } from "./client";
import { MOCK_FEED } from "@/lib/mockData";

export interface GetPostResponse {
  post: FeedItem;
  comments: PostComment[];
}

export async function getFeed(): Promise<FeedItem[]> {
  if (!isApiConfigured()) {
    return MOCK_FEED;
  }
  try {
    const data = await apiRequest<unknown>("/feed");
    if (!Array.isArray(data)) return MOCK_FEED;
    return data as FeedItem[];
  } catch {
    return MOCK_FEED;
  }
}

export async function getPost(id: string): Promise<GetPostResponse | null> {
  if (!isApiConfigured()) return null;
  try {
    return await apiRequest<GetPostResponse>(`/feed/${id}`);
  } catch {
    return null;
  }
}

export interface PostFeedInput {
  content: string;
  type?: "post" | "achievement" | "community" | "scrap";
  allowComments?: boolean;
  allowReactions?: boolean;
}

export async function postFeedItem(input: PostFeedInput): Promise<FeedItem> {
  return apiRequest<FeedItem>("/feed", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
