// Channel library ingestion: pull a creator's YouTube uploads into the
// embedded library (ContentItem source = EMBEDDED_YOUTUBE). Idempotent —
// re-running updates metadata on existing rows via the
// (channelId, youtubeVideoId) unique key.

import { ContentKind, ContentSource, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  fetchVideoDetails,
  isIngestable,
  listUploads,
  resolveChannel,
  type YouTubeVideoInfo,
} from "@/lib/youtube-api";

/** Pure transform: YouTube video metadata → ContentItem upsert data. */
export function videoToContentItemData(
  channelDbId: string,
  video: YouTubeVideoInfo,
): Prisma.ContentItemUncheckedCreateInput {
  return {
    channelId: channelDbId,
    source: ContentSource.EMBEDDED_YOUTUBE,
    kind: ContentKind.VIDEO,
    title: video.title,
    description: video.description || null,
    youtubeVideoId: video.videoId,
    durationSec: video.durationSec,
    publishedAt: video.publishedAt ? new Date(video.publishedAt) : null,
  };
}

export interface IngestResult {
  discovered: number;
  ingested: number;
  skipped: number; // private / unlisted / embedding disabled
}

/**
 * Ingest (or refresh) a channel's YouTube library.
 * The channel row must already carry youtubeChannelId.
 */
export async function ingestChannel(
  channelDbId: string,
  opts: { apiKey: string; maxPages?: number },
): Promise<IngestResult> {
  const channel = await db.channel.findUniqueOrThrow({
    where: { id: channelDbId },
    select: { id: true, youtubeChannelId: true },
  });
  if (!channel.youtubeChannelId) {
    throw new Error("Channel has no linked YouTube channel id.");
  }

  const info = await resolveChannel(channel.youtubeChannelId, opts.apiKey);
  if (!info?.uploadsPlaylistId) {
    throw new Error("Could not resolve the channel's uploads playlist.");
  }

  const videoIds = await listUploads(info.uploadsPlaylistId, opts.apiKey, {
    maxPages: opts.maxPages,
  });
  const videos = await fetchVideoDetails(videoIds, opts.apiKey);

  let ingested = 0;
  let skipped = 0;
  for (const video of videos) {
    if (!isIngestable(video)) {
      skipped += 1;
      continue;
    }
    const data = videoToContentItemData(channel.id, video);
    await db.contentItem.upsert({
      where: {
        channelId_youtubeVideoId: {
          channelId: channel.id,
          youtubeVideoId: video.videoId,
        },
      },
      create: data,
      update: {
        title: data.title,
        description: data.description,
        durationSec: data.durationSec,
        publishedAt: data.publishedAt,
      },
    });
    ingested += 1;
  }

  return { discovered: videos.length, ingested, skipped };
}
