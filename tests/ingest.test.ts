import { describe, expect, it } from "vitest";
import { ContentKind, ContentSource } from "@prisma/client";
import { videoToContentItemData } from "@/lib/ingest";
import type { YouTubeVideoInfo } from "@/lib/youtube-api";

const video: YouTubeVideoInfo = {
  videoId: "aaaaaaaaaaa",
  title: "The Resurrection — why it matters",
  description: "Easter teaching",
  durationSec: 1800,
  publishedAt: "2026-04-05T09:00:00Z",
  thumbnailUrl: "https://example.com/t.jpg",
  embeddable: true,
  privacyStatus: "public",
  wasLive: false,
};

describe("videoToContentItemData", () => {
  it("maps a video into embedded content", () => {
    const data = videoToContentItemData("channel-db-id", video);
    expect(data).toEqual({
      channelId: "channel-db-id",
      source: ContentSource.EMBEDDED_YOUTUBE,
      kind: ContentKind.VIDEO,
      title: "The Resurrection — why it matters",
      description: "Easter teaching",
      youtubeVideoId: "aaaaaaaaaaa",
      durationSec: 1800,
      format: "STANDARD",
      publishedAt: new Date("2026-04-05T09:00:00Z"),
    });
  });

  it("nulls empty descriptions and missing publish dates", () => {
    const data = videoToContentItemData("channel-db-id", {
      ...video,
      description: "",
      publishedAt: null,
    });
    expect(data.description).toBeNull();
    expect(data.publishedAt).toBeNull();
  });
});
