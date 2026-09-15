// The watch page's right rail: the rest of a channel's library, newest
// first, loaded a page at a time as the viewer scrolls — YouTube's "up next"
// column. The page renders the first page and /api/channel-videos serves
// every page after it; both read the filter and the order from here, so the
// two can never disagree about what comes next. When the video playing is
// part of a series, the series' next parts come first (lib/series-order) and
// the channel list leaves them out.

import type { Prisma } from "@prisma/client";
import { SERIES_UP_NEXT_MAX } from "@/lib/series-order";

export const RAIL_PAGE_SIZE = 20;
export const RAIL_MAX_TAKE = 40;
// The video playing, plus the series parts shown above the channel list.
export const RAIL_MAX_EXCLUDE = SERIES_UP_NEXT_MAX + 1;

// cuid-shaped ids only — anything else is refused before it reaches Prisma.
const ID = /^[A-Za-z0-9_-]{8,64}$/;

/** The channel's live, approved embeds, less what the page already shows. */
export function railWhere(
  channelId: string,
  excludeIds: string[],
): Prisma.ContentItemWhereInput {
  return {
    channelId,
    unavailableAt: null,
    youtubeVideoId: { not: null },
    channel: { status: "APPROVED" },
    ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
  };
}

// id breaks publishedAt ties, so a cursor always resumes at one exact place.
export const RAIL_ORDER: Prisma.ContentItemOrderByWithRelationInput[] = [
  { publishedAt: "desc" },
  { id: "desc" },
];

export const RAIL_SELECT = {
  id: true,
  title: true,
  youtubeVideoId: true,
  durationSec: true,
} as const satisfies Prisma.ContentItemSelect;

export interface RailItem {
  id: string;
  title: string;
  youtubeVideoId: string | null;
  durationSec: number | null;
}

/** The series the video playing belongs to, as the rail shows it. */
export interface RailSeries {
  title: string;
  /** 1-based place of the video playing; null if it isn't listed */
  part: number | null;
  total: number;
  next: RailItem[];
  first: RailItem | null;
}

export interface RailQuery {
  channelId: string;
  cursor: string | null;
  excludeIds: string[];
  take: number;
}

export function parseRailQuery(params: URLSearchParams): RailQuery | { error: string } {
  const channelId = params.get("channelId") ?? "";
  if (!ID.test(channelId)) return { error: "channelId required" };
  const cursor = params.get("cursor");
  if (cursor !== null && !ID.test(cursor)) return { error: "Invalid cursor" };
  // exclude: comma-separated ids, a handful at most.
  const rawExclude = params.get("exclude");
  const excludeIds = rawExclude ? rawExclude.split(",") : [];
  if (excludeIds.length > RAIL_MAX_EXCLUDE || excludeIds.some((id) => !ID.test(id))) {
    return { error: "Invalid exclude" };
  }
  const rawTake = Number(params.get("take") ?? RAIL_PAGE_SIZE);
  const take = Number.isInteger(rawTake)
    ? Math.min(Math.max(rawTake, 1), RAIL_MAX_TAKE)
    : RAIL_PAGE_SIZE;
  return { channelId, cursor, excludeIds, take };
}

/**
 * Rows are fetched with take + 1. The extra row only proves there is more:
 * trim it, and resume after the last row actually shown.
 */
export function pageWithCursor<T extends { id: string }>(
  rows: T[],
  take: number,
): { items: T[]; nextCursor: string | null } {
  const items = rows.slice(0, take);
  const last = items[items.length - 1];
  return { items, nextCursor: rows.length > take && last ? last.id : null };
}

/** The duration badge: 754 → "12:34", 3723 → "1:02:03"; nothing when unknown. */
export function formatRuntime(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}
