// The order of a series is the creator's own (pure, tested).
//
// A series that mirrors a YouTube playlist keeps each video's place in that
// playlist — ingest records it as seriesPosition. Anything without a place (a
// hand-made series, or a video moved in by hand) follows, oldest first, so a
// series still reads from its beginning.

import type { Prisma } from "@prisma/client";

export const SERIES_ORDER: Prisma.ContentItemOrderByWithRelationInput[] = [
  { seriesPosition: { sort: "asc", nulls: "last" } },
  { publishedAt: "asc" },
  { id: "asc" },
];

/** How many of a series' next parts the watch page offers before the channel. */
export const SERIES_UP_NEXT_MAX = 10;

/** Each video's place in a playlist, 0-based. A video listed twice keeps its first place. */
export function playlistPositions(videoIds: string[]): Map<string, number> {
  const positions = new Map<string, number>();
  videoIds.forEach((id, index) => {
    if (!positions.has(id)) positions.set(id, index);
  });
  return positions;
}

/**
 * The writes that put a series' videos in playlist order. A video no longer
 * in the playlist loses its place (it sorts last); one already in its place
 * isn't written.
 */
export function positionUpdates(
  members: { id: string; youtubeVideoId: string | null; seriesPosition: number | null }[],
  positions: Map<string, number>,
): { id: string; seriesPosition: number | null }[] {
  return members.flatMap((member) => {
    const place = member.youtubeVideoId
      ? (positions.get(member.youtubeVideoId) ?? null)
      : null;
    return place === member.seriesPosition ? [] : [{ id: member.id, seriesPosition: place }];
  });
}

/**
 * Where the video playing sits in its series, and the parts that follow it.
 * `part` is 1-based; null when the video isn't among `ordered`.
 */
export function seriesUpNext<T extends { id: string }>(
  ordered: T[],
  currentId: string,
  limit = SERIES_UP_NEXT_MAX,
): { part: number | null; total: number; next: T[]; first: T | null } {
  const index = ordered.findIndex((item) => item.id === currentId);
  const after = index === -1 ? ordered : ordered.slice(index + 1);
  return {
    part: index === -1 ? null : index + 1,
    total: ordered.length,
    next: after.slice(0, limit),
    first: ordered[0] ?? null,
  };
}
