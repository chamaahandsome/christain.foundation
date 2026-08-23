// Channel library ingestion: pull a creator's YouTube uploads into the
// embedded library (ContentItem source = EMBEDDED_YOUTUBE). Idempotent —
// re-running updates metadata on existing rows via the
// (channelId, youtubeVideoId) unique key.

import { ContentKind, ContentSource, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  classifyFormat,
  fetchVideoDetails,
  isIngestable,
  listPlaylists,
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
    format: classifyFormat(video),
    // Topical search fodder: creator tags. Transcripts need owner OAuth
    // (captions.download) — planned, see PLAN §8.
    searchText: video.tags.length > 0 ? video.tags.join(" ") : null,
    publishedAt: video.publishedAt ? new Date(video.publishedAt) : null,
  };
}

export interface IngestResult {
  discovered: number;
  ingested: number;
  created: number; // new to the library (drives follower notifications)
  updated: number; // metadata refresh on existing rows
  skipped: number; // private / unlisted / embedding disabled
  playlistsSynced: number; // YouTube playlists mirrored as CF series
  createdItems: { id: string; title: string }[];
}

/**
 * Mirror the channel's YouTube playlists as CF series and place imported
 * videos into them. Manual curation wins: only items without a series are
 * placed, and a video in several playlists keeps its first placement.
 */
export async function syncPlaylistsAsSeries(
  channelDbId: string,
  youtubeChannelId: string,
  apiKey: string,
): Promise<number> {
  const playlists = await listPlaylists(youtubeChannelId, apiKey);
  let synced = 0;

  for (const [index, playlist] of playlists.entries()) {
    if (playlist.itemCount === 0) continue;
    // A playlist is just a playlist of video ids — reuse the pager (2 pages
    // = the newest 100 entries per playlist keeps quota negligible).
    const videoIds = await listUploads(playlist.playlistId, apiKey, { maxPages: 2 });
    const matching = videoIds.length
      ? await db.contentItem.count({
          where: { channelId: channelDbId, youtubeVideoId: { in: videoIds } },
        })
      : 0;
    // Don't mint empty series — a playlist becomes a series only once some
    // of its videos exist in the CF library (deep playlists fill in as
    // later imports reach them).
    const existing = await db.series.findUnique({
      where: { youtubePlaylistId: playlist.playlistId },
      select: { id: true },
    });
    if (matching === 0 && !existing) continue;

    const series = await db.series.upsert({
      where: { youtubePlaylistId: playlist.playlistId },
      create: {
        channelId: channelDbId,
        youtubePlaylistId: playlist.playlistId,
        title: playlist.title,
        description: playlist.description || null,
        sortOrder: index,
      },
      update: {
        title: playlist.title,
        description: playlist.description || null,
        sortOrder: index,
      },
    });
    if (matching > 0) {
      await db.contentItem.updateMany({
        where: {
          channelId: channelDbId,
          youtubeVideoId: { in: videoIds },
          seriesId: null,
        },
        data: { seriesId: series.id },
      });
    }
    synced += 1;
  }
  return synced;
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
        format: data.format,
        searchText: data.searchText,
        publishedAt: data.publishedAt,
        unavailableAt: null, // it just answered the API — it's alive
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

  // Mirror playlists as series once the items exist to attach to.
  const playlistsSynced = await syncPlaylistsAsSeries(
    channel.id,
    info.channelId,
    opts.apiKey,
  );

  return {
    discovered: videos.length,
    ingested,
    created,
    updated,
    skipped,
    playlistsSynced,
    createdItems,
  };
}
