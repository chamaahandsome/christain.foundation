// Channel library ingestion: pull a creator's YouTube uploads into the
// embedded library (ContentItem source = EMBEDDED_YOUTUBE). Idempotent —
// re-running updates metadata on existing rows via the
// (channelId, youtubeVideoId) unique key.

import { ContentKind, ContentSource, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  classifyFormat,
  detectFormat,
  fetchVideoDetails,
  isIngestable,
  listPlaylists,
  listUploads,
  resolveChannel,
  type VideoFormat,
  type YouTubeVideoInfo,
} from "@/lib/youtube-api";
import { playlistPositions, positionUpdates } from "@/lib/series-order";

export type IngestDecision = "import" | "skip-unavailable" | "skip-short";

/**
 * Whether a video enters the library (pure, tested). Only public, embeddable
 * videos can be served, and YouTube Shorts are not imported at all.
 */
export function ingestDecision(video: YouTubeVideoInfo, format: VideoFormat): IngestDecision {
  if (!isIngestable(video)) return "skip-unavailable";
  if (format === "SHORT") return "skip-short";
  return "import";
}

/**
 * Pure transform: YouTube video metadata → ContentItem upsert data. Pass the
 * format when it has been detected (see detectFormat); otherwise the
 * heuristic decides.
 */
export function videoToContentItemData(
  channelDbId: string,
  video: YouTubeVideoInfo,
  format: VideoFormat = classifyFormat(video),
): Prisma.ContentItemUncheckedCreateInput {
  return {
    channelId: channelDbId,
    source: ContentSource.EMBEDDED_YOUTUBE,
    kind: ContentKind.VIDEO,
    title: video.title,
    description: video.description || null,
    youtubeVideoId: video.videoId,
    durationSec: video.durationSec,
    format,
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
  shortsSkipped: number; // YouTube Shorts, which are not imported
  playlistsSynced: number; // YouTube playlists mirrored as CF series
  createdItems: { id: string; title: string }[];
}

/**
 * Mirror the channel's YouTube playlists as CF series and place imported
 * videos into them. Manual curation wins: only items without a series are
 * placed, and a video in several playlists keeps its first placement. Each
 * series keeps its playlist's order: every video takes its place in the list.
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
    // A playlist is just a list of video ids, in the creator's order — reuse
    // the pager. 20 pages reads 1,000 entries, at one quota unit a page.
    const videoIds = await listUploads(playlist.playlistId, apiKey, { maxPages: 20 });
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
    // Put the series in the creator's order. An empty read is a hiccup, not
    // an empty playlist (those were skipped above), so it changes nothing.
    if (videoIds.length > 0) {
      const members = await db.contentItem.findMany({
        where: { seriesId: series.id },
        select: { id: true, youtubeVideoId: true, seriesPosition: true },
      });
      const updates = positionUpdates(members, playlistPositions(videoIds));
      if (updates.length > 0) {
        await db.$transaction(
          updates.map((update) =>
            db.contentItem.update({
              where: { id: update.id },
              data: { seriesPosition: update.seriesPosition },
            }),
          ),
        );
      }
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

  // Formats first, a few at a time. Only videos short enough to be a Short
  // cost a request to YouTube (detectFormat); the rest resolve instantly.
  const formats = new Map<string, VideoFormat>();
  const candidates = videos.filter(isIngestable);
  for (let i = 0; i < candidates.length; i += 8) {
    const batch = candidates.slice(i, i + 8);
    const detected = await Promise.all(batch.map((video) => detectFormat(video)));
    batch.forEach((video, j) => formats.set(video.videoId, detected[j]));
  }

  let ingested = 0;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let shortsSkipped = 0;
  const createdItems: { id: string; title: string }[] = [];

  for (const video of videos) {
    const format = formats.get(video.videoId) ?? classifyFormat(video);
    const decision = ingestDecision(video, format);
    if (decision === "skip-unavailable") {
      skipped += 1;
      continue;
    }
    if (decision === "skip-short") {
      shortsSkipped += 1;
      continue;
    }
    const data = videoToContentItemData(channel.id, video, format);
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
    shortsSkipped,
    playlistsSynced,
    createdItems,
  };
}
