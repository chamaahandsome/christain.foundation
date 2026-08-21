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
  created: number; // new to the library (drives follower notifications)
  updated: number; // metadata refresh on existing rows
  skipped: number; // private / unlisted / embedding disabled
  createdItems: { id: string; title: string }[];
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
    throw new Error(
      "Could not find that YouTube channel. Check the channel in Settings — the @handle, UC… id, or channel URL all work.",
    );
  }

  const videoIds = await listUploads(info.uploadsPlaylistId, opts.apiKey, {
    maxPages: opts.maxPages,
  });
  const videos = await fetchVideoDetails(videoIds, opts.apiKey);

  const existing = await db.contentItem.findMany({
    where: { channelId: channel.id, youtubeVideoId: { in: videoIds } },
    select: { youtubeVideoId: true },
  });
  const existingIds = new Set(existing.map((row) => row.youtubeVideoId));

  let ingested = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const createdItems: { id: string; title: string }[] = [];

  for (const video of videos) {
    if (!isIngestable(video)) {
      skipped += 1;
      continue;
    }
    const data = videoToContentItemData(channel.id, video);
    const row = await db.contentItem.upsert({
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
    if (existingIds.has(video.videoId)) {
      updated += 1;
    } else {
      created += 1;
      createdItems.push({ id: row.id, title: row.title });
    }
  }

  return { discovered: videos.length, ingested, created, updated, skipped, createdItems };
}
