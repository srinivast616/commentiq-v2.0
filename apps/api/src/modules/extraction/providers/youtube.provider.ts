import { env } from "../../../config/env";
import { ApiError } from "../../../middleware/error-handler.middleware";

export interface RawComment {
  externalCommentId: string;
  username: string;
  authorIsVerified: boolean;
  text: string;
  likeCount: number;
  replyCount: number;
  postedAt: string;
}

function extractVideoId(url: string): string {
  const patterns = [/[?&]v=([^&]+)/, /youtu\.be\/([^?&]+)/, /youtube\.com\/shorts\/([^?&]+)/];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  throw new ApiError(400, "invalid_youtube_url", "Could not extract a video ID from that YouTube URL");
}

// Pulls top-level comments via YouTube Data API v3 (commentThreads.list),
// paginating until either all comments are fetched or a safety cap is hit
// (avoids one huge video exhausting the whole API quota in a single job —
// see the architecture doc's note on backpressure/quota handling).
const MAX_COMMENTS = 2000;
const PAGE_SIZE = 100;

export async function fetchYouTubeComments(videoUrl: string): Promise<{ videoId: string; title: string; comments: RawComment[] }> {
  if (!env.youtubeApiKey) {
    throw new ApiError(
      400,
      "youtube_api_key_missing",
      "YOUTUBE_API_KEY is not configured on the server. Set it in .env to enable YouTube ingestion."
    );
  }

  const videoId = extractVideoId(videoUrl);

  const videoRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${env.youtubeApiKey}`
  );
  const videoJson = (await videoRes.json()) as any;
  if (!videoRes.ok || !videoJson.items?.length) {
    throw new ApiError(404, "video_not_found", videoJson?.error?.message ?? "YouTube video not found");
  }
  const title = videoJson.items[0].snippet.title as string;

  const comments: RawComment[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      part: "snippet",
      videoId,
      maxResults: String(PAGE_SIZE),
      key: env.youtubeApiKey,
      textFormat: "plainText",
      order: "relevance",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`https://www.googleapis.com/youtube/v3/commentThreads?${params.toString()}`);
    const json = (await res.json()) as any;

    if (!res.ok) {
      // Comments disabled on the video, or quota exceeded — surface a clear error
      // rather than silently returning zero comments.
      throw new ApiError(502, "youtube_api_error", json?.error?.message ?? "YouTube API request failed");
    }

    for (const item of json.items ?? []) {
      const snippet = item.snippet.topLevelComment.snippet;
      comments.push({
        externalCommentId: item.snippet.topLevelComment.id,
        username: snippet.authorDisplayName,
        authorIsVerified: false,
        text: snippet.textDisplay,
        likeCount: snippet.likeCount ?? 0,
        replyCount: item.snippet.totalReplyCount ?? 0,
        postedAt: snippet.publishedAt,
      });
    }

    pageToken = json.nextPageToken;
  } while (pageToken && comments.length < MAX_COMMENTS);

  return { videoId, title, comments: comments.slice(0, MAX_COMMENTS) };
}
