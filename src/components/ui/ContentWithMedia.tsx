import type React from "react";

/**
 * Renders content string: text, image/GIF URLs as <img>, and YouTube URLs as embedded preview.
 */
const IMAGE_EXT = /\.(gif|jpe?g|png|webp)(\?.*)?$/i;
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
/** CDN hosts that serve direct image/GIF URLs */
const IMAGE_CDN = /(media\.giphy\.com|i\.giphy\.com|media\.tenor\.com|i\.tenor\.com)/i;

const YOUTUBE_HOST = /(youtube\.com|youtu\.be)/i;

function isImageOrGifUrl(urlString: string): boolean {
  const trimmed = urlString.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    const path = url.pathname.toLowerCase();
    const host = url.hostname.toLowerCase();
    if (IMAGE_EXT.test(path) || IMAGE_EXT.test(trimmed)) return true;
    if (IMAGE_CDN.test(host)) return true;
    return false;
  } catch {
    return IMAGE_EXT.test(trimmed) || IMAGE_CDN.test(trimmed);
  }
}

/** Extract YouTube video ID from watch, embed, or youtu.be URLs. */
function getYoutubeVideoId(urlString: string): string | null {
  try {
    const url = new URL(urlString.trim());
    const host = url.hostname.toLowerCase();
    if (!YOUTUBE_HOST.test(host)) return null;
    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      return id && id.length >= 10 ? id : null;
    }
    if (url.pathname === "/watch" && url.searchParams.has("v")) {
      return url.searchParams.get("v");
    }
    const embedMatch = url.pathname.match(/^\/embed\/([a-zA-Z0-9_-]+)/);
    if (embedMatch) return embedMatch[1];
    return null;
  } catch {
    return null;
  }
}

type Segment =
  | { type: "text"; value: string }
  | { type: "img"; src: string }
  | { type: "youtube"; videoId: string };

/** Split a line into segments: text, image URLs, and YouTube URLs. */
function parseLineForMedia(line: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  const matches = line.matchAll(URL_REGEX);
  for (const m of matches) {
    const url = m[0];
    const videoId = getYoutubeVideoId(url);
    if (videoId) {
      if (m.index! > lastIndex) {
        segments.push({ type: "text", value: line.slice(lastIndex, m.index) });
      }
      segments.push({ type: "youtube", videoId });
      lastIndex = m.index! + url.length;
    } else if (isImageOrGifUrl(url)) {
      if (m.index! > lastIndex) {
        segments.push({ type: "text", value: line.slice(lastIndex, m.index) });
      }
      segments.push({ type: "img", src: url });
      lastIndex = m.index! + url.length;
    }
  }
  if (lastIndex < line.length) {
    segments.push({ type: "text", value: line.slice(lastIndex) });
  }
  if (segments.length === 0) {
    segments.push({ type: "text", value: line });
  }
  return segments;
}

export type MediaSegment = { url: string; type: "img"; src: string } | { url: string; type: "youtube"; videoId: string };

/** Parse full content into text (no URLs) and list of media with URL for removal. */
export function parseContentToTextAndMedia(content: string): { textOnly: string; media: MediaSegment[] } {
  const lines = content.split(/\n/);
  const textParts: string[] = [];
  const media: MediaSegment[] = [];
  lines.forEach((line) => {
    const segments = parseLineForMedia(line);
    const lineUrls = [...line.matchAll(URL_REGEX)].map((m) => m[0]);
    segments.forEach((seg) => {
      if (seg.type === "text") {
        textParts.push(seg.value);
      } else if (seg.type === "img") {
        media.push({ url: seg.src, type: "img", src: seg.src });
      } else {
        const url = lineUrls.find((u) => getYoutubeVideoId(u) === seg.videoId) ?? `https://www.youtube.com/watch?v=${seg.videoId}`;
        media.push({ url, type: "youtube", videoId: seg.videoId });
      }
    });
    textParts.push("\n");
  });
  const textOnly = textParts.join("").replace(/\n+$/, "").replace(/^\n+/, "");
  return { textOnly, media };
}

/** Remove one URL from content string and clean extra spaces/newlines. */
export function contentWithoutUrl(content: string, urlToRemove: string): string {
  return content
    .replace(urlToRemove, "")
    .replace(/\n{2,}/g, "\n")
    .replace(/  +/g, " ")
    .trim();
}

interface ContentWithMediaProps {
  content?: string | null;
  className?: string;
}

// #region agent log
const _log = (loc: string, msg: string, data: Record<string, unknown>) => {
  fetch("http://127.0.0.1:7243/ingest/a5d22442-9ad0-4754-8b54-cb093bb3d2cf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location: loc, message: msg, data, timestamp: Date.now(), hypothesisId: "H5" }),
  }).catch(() => {});
};
// #endregion

export function ContentWithMedia({ content, className }: ContentWithMediaProps) {
  const safeContent = content ?? "";
  _log("ContentWithMedia.tsx:render", "ContentWithMedia_render", {
    contentType: typeof content,
    contentLen: safeContent.length,
  });
  const lines = safeContent.split(/\n/);
  const parts: React.ReactNode[] = [];
  lines.forEach((line, i) => {
    const segments = parseLineForMedia(line);
    segments.forEach((seg, j) => {
      if (seg.type === "text") {
        if (seg.value) {
          parts.push(<span key={`${i}-${j}`}>{seg.value}</span>);
        }
      } else if (seg.type === "img") {
        parts.push(
          <img
            key={`${i}-${j}`}
            src={seg.src}
            alt=""
            className="rounded max-w-full max-h-64 object-contain my-1 block"
          />
        );
      } else {
        parts.push(
          <div key={`${i}-${j}`} className="my-2 rounded overflow-hidden max-w-full w-full aspect-video">
            <iframe
              src={`https://www.youtube.com/embed/${seg.videoId}`}
              title="YouTube video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        );
      }
    });
    if (i < lines.length - 1) {
      parts.push(<span key={`nl-${i}`}>{"\n"}</span>);
    }
  });

  return (
    <div className={`text-sm text-card-foreground leading-relaxed whitespace-pre-wrap break-words ${className ?? ""}`}>
      {parts}
    </div>
  );
}
