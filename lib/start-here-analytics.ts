// Start Here usage analytics — the rules, pure and tested.
//
// Two events, both first-party and anonymous: a step view, and a play of a
// video, debate or series. A visitor is a random per-browser id (no name,
// email or fingerprint); a signed-in user id rides along only when there is
// one. Everything here is a plain function over rows, so the admin page and
// the tests read exactly the same definitions.

import { z } from "zod";
import {
  isPlaceholderVideo,
  seriesDepthKey,
  topicDebates,
  topicPlaylists,
  videoDepthKey,
  type StartHereData,
  type StartHereTopic,
} from "@/lib/start-here";

export const START_HERE_EVENT_TYPES = ["step_view", "video_play"] as const;
export type StartHereEventType = (typeof START_HERE_EVENT_TYPES)[number];

/**
 * What the page sends. Items reuse the milk/meat keys — "video:<youtubeId>"
 * for picks and debates, "series:<playlistId>" for series.
 */
export const StartHereEventSchema = z.object({
  type: z.enum(START_HERE_EVENT_TYPES),
  visitorId: z.string().regex(/^[A-Za-z0-9-]{16,64}$/),
  stepSlug: z.string().min(1).max(100),
  itemKey: z.string().min(1).max(200).optional(),
});
export type StartHereEvent = z.infer<typeof StartHereEventSchema>;

export type ItemKind = "video" | "debate" | "series";

export interface CatalogItem {
  key: string;
  kind: ItemKind;
  title: string;
  creator: string;
  stepSlug: string;
  stepOrder: number;
  stepLabel: string;
}

/** Every live item on the pathway, in pathway order: picks, series, debates. */
export function itemCatalog(topics: StartHereTopic[]): CatalogItem[] {
  const items: CatalogItem[] = [];
  for (const topic of [...topics].sort((a, b) => a.order - b.order)) {
    const at = { stepSlug: topic.slug, stepOrder: topic.order, stepLabel: topic.label };
    for (const video of [...topic.videos].sort((a, b) => a.order - b.order)) {
      if (isPlaceholderVideo(video)) continue;
      items.push({ key: videoDepthKey(video.youtube_id), kind: "video", title: video.title, creator: video.creator, ...at });
    }
    for (const series of topicPlaylists(topic)) {
      items.push({ key: seriesDepthKey(series.youtube_playlist_id), kind: "series", title: series.title, creator: series.creator, ...at });
    }
    for (const debate of topicDebates(topic)) {
      if (isPlaceholderVideo(debate)) continue;
      items.push({ key: videoDepthKey(debate.youtube_id), kind: "debate", title: debate.title, creator: debate.creator, ...at });
    }
  }
  return items;
}

/** Why an event can't be recorded — or null when it describes something real. */
export function eventProblem(event: StartHereEvent, data: StartHereData): string | null {
  const topic = data.topics.find((t) => t.slug === event.stepSlug);
  if (!topic) return "unknown step";
  if (event.type === "step_view") {
    return event.itemKey ? "a step view carries no item" : null;
  }
  if (!event.itemKey) return "a play needs an item";
  const onStep = itemCatalog([topic]).some((item) => item.key === event.itemKey);
  return onStep ? null : "that item isn't on this step";
}

// ---------- the numbers ----------

export interface StepViewRow {
  stepSlug: string;
  visitorId: string;
  userId?: string | null;
}

export interface PlayRow {
  itemKey: string;
  visitorId: string;
}

export interface FunnelStep {
  order: number;
  slug: string;
  label: string;
  /** distinct visitors who reached this step */
  visitors: number;
  /** as a share of step 1's visitors */
  ofFirst: number | null;
  /** as a share of the step before */
  fromPrevious: number | null;
}

/**
 * Distinct visitors who reached each step, in pathway order. A deep link
 * can land someone on a later step first, so a later step can exceed step 1.
 */
export function stepFunnel(topics: StartHereTopic[], rows: StepViewRow[]): FunnelStep[] {
  const bySlug = new Map<string, Set<string>>();
  for (const row of rows) {
    let visitors = bySlug.get(row.stepSlug);
    if (!visitors) bySlug.set(row.stepSlug, (visitors = new Set()));
    visitors.add(row.visitorId);
  }
  const ordered = [...topics].sort((a, b) => a.order - b.order);
  const first = ordered.length ? (bySlug.get(ordered[0].slug)?.size ?? 0) : 0;
  let previous: number | null = null;
  return ordered.map((topic) => {
    const visitors = bySlug.get(topic.slug)?.size ?? 0;
    const step: FunnelStep = {
      order: topic.order,
      slug: topic.slug,
      label: topic.label,
      visitors,
      ofFirst: first > 0 ? visitors / first : null,
      fromPrevious: previous !== null && previous > 0 ? visitors / previous : null,
    };
    previous = visitors;
    return step;
  });
}

export interface StartHereSummary {
  /** distinct visitors who viewed any step */
  visitors: number;
  /** of those, how many were signed in at least once */
  signedInVisitors: number;
  /** distinct visitors who reached the final step */
  reachedFinalStep: number;
  /** reachedFinalStep / visitors */
  completionRate: number | null;
  plays: number;
  /** distinct visitors who pressed play on anything */
  playingVisitors: number;
}

export function summarize(
  topics: StartHereTopic[],
  stepRows: StepViewRow[],
  playRows: PlayRow[],
): StartHereSummary {
  const visitors = new Set(stepRows.map((row) => row.visitorId));
  const signedIn = new Set(stepRows.filter((row) => row.userId).map((row) => row.visitorId));
  const last = [...topics].sort((a, b) => b.order - a.order)[0];
  const finished = new Set(
    stepRows.filter((row) => last && row.stepSlug === last.slug).map((row) => row.visitorId),
  );
  return {
    visitors: visitors.size,
    signedInVisitors: signedIn.size,
    reachedFinalStep: finished.size,
    completionRate: visitors.size > 0 ? finished.size / visitors.size : null,
    plays: playRows.length,
    playingVisitors: new Set(playRows.map((row) => row.visitorId)).size,
  };
}

export interface ItemPlays extends CatalogItem {
  plays: number;
  /** distinct visitors who played it */
  visitors: number;
}

/**
 * Every live item with its plays and distinct viewers — most played first,
 * pathway order breaking ties. Unplayed items stay in at zero, so curators
 * can see what nobody opens.
 */
export function playLeaderboard(topics: StartHereTopic[], rows: PlayRow[]): ItemPlays[] {
  const plays = new Map<string, number>();
  const viewers = new Map<string, Set<string>>();
  for (const row of rows) {
    plays.set(row.itemKey, (plays.get(row.itemKey) ?? 0) + 1);
    let seen = viewers.get(row.itemKey);
    if (!seen) viewers.set(row.itemKey, (seen = new Set()));
    seen.add(row.visitorId);
  }
  return itemCatalog(topics)
    .map((item, index) => ({
      index,
      entry: { ...item, plays: plays.get(item.key) ?? 0, visitors: viewers.get(item.key)?.size ?? 0 },
    }))
    .sort((a, b) => b.entry.plays - a.entry.plays || a.index - b.index)
    .map(({ entry }) => entry);
}
