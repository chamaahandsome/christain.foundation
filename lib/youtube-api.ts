// Thin client for the YouTube Data API v3, used for library ingestion
// (concept §8: the free library is embedded, not hosted). Response parsing is
// split into pure functions so it can be tested without network access.

const API_BASE = "https://www.googleapis.com/youtube/v3";

export interface YouTubeChannelInfo {
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  uploadsPlaylistId: string | null;
}

export interface YouTubeVideoInfo {
  videoId: string;
  title: string;
  description: string;
  durationSec: number | null;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  embeddable: boolean;
  privacyStatus: string;
  /** True when this is (the archive of) a live stream. */
  wasLive: boolean;
  /** Creator-set topical tags — feeds searchText until transcripts land. */
  tags: string[];
}

export interface YouTubePlaylistInfo {
  playlistId: string;
  title: string;
  description: string;
  itemCount: number;
}

export class YouTubeApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "YouTubeApiError";
  }
}

// ---------- pure parsers ----------

function bestThumbnail(thumbnails: Record<string, { url?: string }> | undefined): string | null {
  if (!thumbnails) return null;
  for (const key of ["maxres", "high", "medium", "default"]) {
    const url = thumbnails[key]?.url;
    if (url) return url;
  }
  return null;
}

export function parseChannelResponse(json: unknown): YouTubeChannelInfo | null {
  const item = (json as { items?: unknown[] })?.items?.[0] as
    | {
        id?: string;
        snippet?: { title?: string; description?: string; thumbnails?: Record<string, { url?: string }> };
        contentDetails?: { relatedPlaylists?: { uploads?: string } };
      }
    | undefined;
  if (!item?.id) return null;
  return {
    channelId: item.id,
    title: item.snippet?.title ?? "",
    description: item.snippet?.description ?? "",
    thumbnailUrl: bestThumbnail(item.snippet?.thumbnails),
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads ?? null,
  };
}

export function parsePlaylistItemsResponse(json: unknown): {
  videoIds: string[];
  nextPageToken: string | null;
} {
  const data = json as {
    items?: { contentDetails?: { videoId?: string } }[];
    nextPageToken?: string;
  };
  const videoIds = (data.items ?? [])
    .map((item) => item.contentDetails?.videoId)
    .filter((id): id is string => Boolean(id));
  return { videoIds, nextPageToken: data.nextPageToken ?? null };
}

export function parseVideosResponse(json: unknown): YouTubeVideoInfo[] {
  const data = json as {
    items?: {
      id?: string;
      snippet?: {
        title?: string;
        description?: string;
        publishedAt?: string;
        thumbnails?: Record<string, { url?: string }>;
        tags?: string[];
      };
      contentDetails?: { duration?: string };
      status?: { embeddable?: boolean; privacyStatus?: string };
      liveStreamingDetails?: { actualStartTime?: string };
    }[];
  };
  return (data.items ?? [])
    .filter((item): item is typeof item & { id: string } => Boolean(item.id))
    .map((item) => ({
      videoId: item.id,
      title: item.snippet?.title ?? "",
      description: item.snippet?.description ?? "",
      durationSec: item.contentDetails?.duration
        ? parseIsoDurationLoose(item.contentDetails.duration)
        : null,
      publishedAt: item.snippet?.publishedAt ?? null,
      thumbnailUrl: bestThumbnail(item.snippet?.thumbnails),
      embeddable: item.status?.embeddable ?? false,
      privacyStatus: item.status?.privacyStatus ?? "unknown",
      wasLive: Boolean(item.liveStreamingDetails?.actualStartTime),
      tags: item.snippet?.tags ?? [],
    }));
}

export function parsePlaylistsResponse(json: unknown): {
  playlists: YouTubePlaylistInfo[];
  nextPageToken: string | null;
} {
  const data = json as {
    items?: {
      id?: string;
      snippet?: { title?: string; description?: string };
      contentDetails?: { itemCount?: number };
    }[];
    nextPageToken?: string;
  };
  return {
    playlists: (data.items ?? [])
      .filter((item): item is typeof item & { id: string } => Boolean(item.id))
      .map((item) => ({
        playlistId: item.id,
        title: item.snippet?.title ?? "",
        description: item.snippet?.description ?? "",
        itemCount: item.contentDetails?.itemCount ?? 0,
      })),
    nextPageToken: data.nextPageToken ?? null,
  };
}

export type VideoFormat = "STANDARD" | "SHORT" | "LIVE";

/**
 * Classify a video the way YouTube presents it. The API has no Shorts flag,
 * so this is a heuristic: anything a minute or under is a Short; up to the
 * current 3-minute Shorts cap counts only when the creator tagged it
 * #shorts. Live detection is exact (liveStreamingDetails).
 */
export function classifyFormat(video: {
  wasLive: boolean;
  durationSec: number | null;
  title: string;
  description: string;
}): VideoFormat {
  if (video.wasLive) return "LIVE";
  const duration = video.durationSec;
  if (duration != null && duration > 0) {
    if (duration <= 63) return "SHORT";
    if (duration <= 183 && /#shorts?\b/i.test(`${video.title} ${video.description}`)) {
      return "SHORT";
    }
  }
  return "STANDARD";
}

// Local import to avoid a cycle: lib/youtube.ts exports parseIsoDuration.
import { parseIsoDuration } from "@/lib/youtube";
function parseIsoDurationLoose(iso: string): number | null {
  return parseIsoDuration(iso);
}

/**
 * Only public, embeddable videos enter the library — the embedded model
 * cannot serve anything else, and unlisted/private uploads are not ours to
 * surface.
 */
export function isIngestable(video: YouTubeVideoInfo): boolean {
  return video.embeddable && video.privacyStatus === "public";
}

// ---------- fetch layer ----------

async function apiGet(
  path: string,
  params: Record<string, string>,
  apiKey: string,
): Promise<unknown> {
  const url = new URL(`${API_BASE}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("key", apiKey);

  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new YouTubeApiError(
      `YouTube API ${path} failed with ${res.status}`,
      res.status,
    );
  }
  return res.json();
}

const CHANNEL_ID_PATTERN = /^UC[A-Za-z0-9_-]{22}$/;

export type ChannelRef =
  | { kind: "id"; value: string }
  | { kind: "handle"; value: string }
  | { kind: "username"; value: string };

/**
 * Parse whatever a person pastes for "my YouTube channel" (pure, tested):
 * UC… ids, @handles, bare handles, and full URLs in their common shapes —
 * youtube.com/@handle[/tab], /channel/UC…, /user/Name, /c/Name — with or
 * without protocol, www., or m. Legacy /c/ custom slugs usually match the
 * handle, so they're tried as one. Returns null only for unparseable input.
 */
export function parseChannelInput(input: string): ChannelRef | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (CHANNEL_ID_PATTERN.test(trimmed)) return { kind: "id", value: trimmed };

  const urlMatch = trimmed.match(
    /^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com(\/[^\s]*)$/i,
  );
  if (urlMatch) {
    const segments = urlMatch[1].split(/[?#]/)[0].split("/").filter(Boolean);
    const [first, second] = segments;
    if (first?.startsWith("@") && first.length > 1) {
      return { kind: "handle", value: first.slice(1) };
    }
    if (first === "channel" && second && CHANNEL_ID_PATTERN.test(second)) {
      return { kind: "id", value: second };
    }
    if (first === "user" && second) return { kind: "username", value: second };
    if (first === "c" && second) return { kind: "handle", value: second };
    return null;
  }
  if (/^https?:\/\//i.test(trimmed)) return null; // some other site's URL

  const handle = trimmed.replace(/^@/, "");
  return handle ? { kind: "handle", value: handle } : null;
}

/** Canonical stored form: UC… id, @handle, or the trimmed original for
 * legacy /user/ URLs (the resolver re-parses those). */
export function canonicalChannelInput(input: string): string | null {
  const ref = parseChannelInput(input);
  if (!ref) return null;
  if (ref.kind === "id") return ref.value;
  if (ref.kind === "handle") return `@${ref.value}`;
  return input.trim();
}

/** Resolve a channel from any accepted input form (see parseChannelInput). */
export async function resolveChannel(
  idOrHandle: string,
  apiKey: string,
): Promise<YouTubeChannelInfo | null> {
  const ref = parseChannelInput(idOrHandle);
  if (!ref) return null;
  const params: Record<string, string> = {
    part: "snippet,contentDetails",
  };
  if (ref.kind === "id") params.id = ref.value;
  else if (ref.kind === "username") params.forUsername = ref.value;
  else params.forHandle = ref.value;
  const json = await apiGet("channels", params, apiKey);
  return parseChannelResponse(json);
}

/** List video ids from a channel's uploads playlist, newest first. */
export async function listUploads(
  uploadsPlaylistId: string,
  apiKey: string,
  opts: { maxPages?: number } = {},
): Promise<string[]> {
  const maxPages = opts.maxPages ?? 10; // 10 pages × 50 = 500 videos
  const videoIds: string[] = [];
  let pageToken: string | null = null;

  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string> = {
      part: "contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults: "50",
    };
    if (pageToken) params.pageToken = pageToken;
    const json = await apiGet("playlistItems", params, apiKey);
    const parsed = parsePlaylistItemsResponse(json);
    videoIds.push(...parsed.videoIds);
    pageToken = parsed.nextPageToken;
    if (!pageToken) break;
  }
  return videoIds;
}

/** Fetch details for up to thousands of videos, chunked at the API's 50 max. */
export async function fetchVideoDetails(
  videoIds: string[],
  apiKey: string,
): Promise<YouTubeVideoInfo[]> {
  const videos: YouTubeVideoInfo[] = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    const json = await apiGet(
      "videos",
      {
        part: "snippet,contentDetails,status,liveStreamingDetails",
        id: chunk.join(","),
      },
      apiKey,
    );
    videos.push(...parseVideosResponse(json));
  }
  return videos;
}

/** List a channel's public playlists (bounded; 50 per page). */
export async function listPlaylists(
  channelId: string,
  apiKey: string,
  opts: { maxPages?: number } = {},
): Promise<YouTubePlaylistInfo[]> {
  const maxPages = opts.maxPages ?? 2; // 100 playlists is plenty
  const playlists: YouTubePlaylistInfo[] = [];
  let pageToken: string | null = null;

  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string> = {
      part: "snippet,contentDetails",
      channelId,
      maxResults: "50",
    };
    if (pageToken) params.pageToken = pageToken;
    const json = await apiGet("playlists", params, apiKey);
    const parsed = parsePlaylistsResponse(json);
    playlists.push(...parsed.playlists);
    pageToken = parsed.nextPageToken;
    if (!pageToken) break;
  }
  return playlists;
}
