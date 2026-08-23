import { describe, expect, it } from "vitest";
import {
  isIngestable,
  parseChannelResponse,
  parsePlaylistItemsResponse,
  parseVideosResponse,
  type YouTubeVideoInfo,
} from "@/lib/youtube-api";

describe("parseChannelResponse", () => {
  it("extracts channel info and uploads playlist", () => {
    const json = {
      items: [
        {
          id: "UCabcdefghijklmnopqrstuv",
          snippet: {
            title: "Grace Chapel",
            description: "Teaching ministry",
            thumbnails: {
              default: { url: "https://example.com/default.jpg" },
              high: { url: "https://example.com/high.jpg" },
            },
          },
          contentDetails: {
            relatedPlaylists: { uploads: "UUabcdefghijklmnopqrstuv" },
          },
        },
      ],
    };
    expect(parseChannelResponse(json)).toEqual({
      channelId: "UCabcdefghijklmnopqrstuv",
      title: "Grace Chapel",
      description: "Teaching ministry",
      thumbnailUrl: "https://example.com/high.jpg", // prefers larger sizes
      uploadsPlaylistId: "UUabcdefghijklmnopqrstuv",
    });
  });

  it("returns null when no channel matches", () => {
    expect(parseChannelResponse({ items: [] })).toBeNull();
    expect(parseChannelResponse({})).toBeNull();
    expect(parseChannelResponse(null)).toBeNull();
  });
});

describe("parsePlaylistItemsResponse", () => {
  it("collects video ids and the next page token", () => {
    const json = {
      items: [
        { contentDetails: { videoId: "aaaaaaaaaaa" } },
        { contentDetails: { videoId: "bbbbbbbbbbb" } },
        { contentDetails: {} }, // deleted video — no id
      ],
      nextPageToken: "TOKEN",
    };
    expect(parsePlaylistItemsResponse(json)).toEqual({
      videoIds: ["aaaaaaaaaaa", "bbbbbbbbbbb"],
      nextPageToken: "TOKEN",
    });
  });

  it("handles the last page", () => {
    expect(parsePlaylistItemsResponse({ items: [] })).toEqual({
      videoIds: [],
      nextPageToken: null,
    });
  });
});

describe("parseVideosResponse", () => {
  it("maps snippet, duration, and status", () => {
    const json = {
      items: [
        {
          id: "aaaaaaaaaaa",
          snippet: {
            title: "Romans 8 — part 1",
            description: "Verse by verse",
            publishedAt: "2026-01-05T10:00:00Z",
            thumbnails: { maxres: { url: "https://example.com/max.jpg" } },
          },
          contentDetails: { duration: "PT45M30S" },
          status: { embeddable: true, privacyStatus: "public" },
        },
      ],
    };
    expect(parseVideosResponse(json)).toEqual([
      {
        videoId: "aaaaaaaaaaa",
        title: "Romans 8 — part 1",
        description: "Verse by verse",
        durationSec: 2730,
        publishedAt: "2026-01-05T10:00:00Z",
        thumbnailUrl: "https://example.com/max.jpg",
        embeddable: true,
        privacyStatus: "public",
        wasLive: false,
      },
    ]);
  });

  it("defaults safely on missing fields", () => {
    const [video] = parseVideosResponse({ items: [{ id: "aaaaaaaaaaa" }] });
    expect(video.embeddable).toBe(false); // never assume embeddable
    expect(video.privacyStatus).toBe("unknown");
    expect(video.durationSec).toBeNull();
  });

  it("drops items without ids", () => {
    expect(parseVideosResponse({ items: [{ snippet: { title: "x" } }] })).toEqual([]);
  });
});

describe("isIngestable", () => {
  const base: YouTubeVideoInfo = {
    videoId: "aaaaaaaaaaa",
    title: "t",
    description: "",
    durationSec: 60,
    publishedAt: null,
    thumbnailUrl: null,
    embeddable: true,
    privacyStatus: "public",
    wasLive: false,
  };

  it("accepts public embeddable videos only", () => {
    expect(isIngestable(base)).toBe(true);
    expect(isIngestable({ ...base, embeddable: false })).toBe(false);
    expect(isIngestable({ ...base, privacyStatus: "unlisted" })).toBe(false);
    expect(isIngestable({ ...base, privacyStatus: "private" })).toBe(false);
  });
});
