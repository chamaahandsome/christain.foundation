// Start Here pathway — loader + validator for content/start-here.json.
// The JSON is hand-curated editorial content; this module is the contract
// the build depends on. Validation rules come from the feature spec:
//
// Structural (always enforced):
//   - unique topic slugs and orders; orders contiguous from 1
//   - `next` chains topics in order; only the last topic has next: null
//   - 3–6 videos per topic; unique video `order` within a topic
//   - tier is `essential` or `open_question`
//
// Content (strict mode — enforced once curation begins / before launch):
//   - no remaining "REPLACE" placeholders, valid youtube ids, durations > 0
//   - max 4 videos per creator across the whole pathway
//   - every open_question topic carries ≥ 2 distinct creators

import rawData from "@/content/start-here.json";
import { isValidYouTubeId } from "@/lib/youtube";

export interface StartHereVideo {
  youtube_id: string;
  title: string;
  creator: string;
  channel_url: string;
  duration_seconds: number;
  why_this_one: string;
  order: number;
}

export type StartHereTier = "essential" | "open_question";

export interface StartHereTopic {
  slug: string;
  order: number;
  question: string;
  tier: StartHereTier;
  tier_note: string;
  framing: string;
  next: string | null;
  videos: StartHereVideo[];
}

export interface StartHereData {
  topics: StartHereTopic[];
}

export const PLACEHOLDER = "REPLACE";
export const MIN_VIDEOS = 3;
export const MAX_VIDEOS = 6;
export const MAX_PER_CREATOR = 4;

export function isPlaceholderVideo(video: StartHereVideo): boolean {
  return (
    video.youtube_id === PLACEHOLDER ||
    video.title === PLACEHOLDER ||
    video.creator === PLACEHOLDER ||
    video.why_this_one === PLACEHOLDER
  );
}

export function hasPlaceholders(data: StartHereData): boolean {
  return data.topics.some((topic) => topic.videos.some(isPlaceholderVideo));
}

export function validateStartHere(
  data: StartHereData,
  opts: { strict?: boolean } = {},
): string[] {
  const errors: string[] = [];
  const { topics } = data;

  if (topics.length === 0) {
    return ["No topics defined."];
  }

  // slugs + orders
  const slugs = new Set<string>();
  const orders = new Set<number>();
  for (const topic of topics) {
    if (slugs.has(topic.slug)) errors.push(`Duplicate topic slug: ${topic.slug}`);
    slugs.add(topic.slug);
    if (orders.has(topic.order)) errors.push(`Duplicate topic order: ${topic.order}`);
    orders.add(topic.order);
    if (topic.tier !== "essential" && topic.tier !== "open_question") {
      errors.push(`${topic.slug}: invalid tier "${topic.tier}"`);
    }
  }
  for (let i = 1; i <= topics.length; i++) {
    if (!orders.has(i)) errors.push(`Topic orders are not contiguous: missing ${i}`);
  }

  // next chain: each topic (except the last by order) must point at the
  // topic with order + 1; the last must be null.
  const byOrder = [...topics].sort((a, b) => a.order - b.order);
  for (let i = 0; i < byOrder.length; i++) {
    const topic = byOrder[i];
    const expected = i + 1 < byOrder.length ? byOrder[i + 1].slug : null;
    if (topic.next !== null && !slugs.has(topic.next)) {
      errors.push(`${topic.slug}: next points at missing slug "${topic.next}"`);
    } else if (topic.next !== expected) {
      errors.push(
        `${topic.slug}: next should be ${expected === null ? "null (last topic)" : `"${expected}"`}, got ${JSON.stringify(topic.next)}`,
      );
    }
  }

  // videos per topic
  for (const topic of topics) {
    if (topic.videos.length < MIN_VIDEOS || topic.videos.length > MAX_VIDEOS) {
      errors.push(
        `${topic.slug}: ${topic.videos.length} videos (must be ${MIN_VIDEOS}–${MAX_VIDEOS})`,
      );
    }
    const videoOrders = new Set<number>();
    for (const video of topic.videos) {
      if (videoOrders.has(video.order)) {
        errors.push(`${topic.slug}: duplicate video order ${video.order}`);
      }
      videoOrders.add(video.order);
    }
    if (topic.framing.trim().length < 40) {
      errors.push(`${topic.slug}: framing is too short to be the value-add`);
    }
  }

  if (opts.strict) {
    // no placeholders, valid ids, real durations
    for (const topic of topics) {
      for (const video of topic.videos) {
        if (isPlaceholderVideo(video)) {
          errors.push(`${topic.slug}: video #${video.order} still has REPLACE placeholders`);
          continue;
        }
        if (!isValidYouTubeId(video.youtube_id)) {
          errors.push(`${topic.slug}: video #${video.order} has invalid youtube_id "${video.youtube_id}"`);
        }
        if (video.duration_seconds <= 0) {
          errors.push(`${topic.slug}: video #${video.order} has no duration`);
        }
        if (!video.channel_url.startsWith("https://www.youtube.com/")) {
          errors.push(`${topic.slug}: video #${video.order} channel_url must be a youtube.com channel link`);
        }
      }
    }

    // curation constraints
    const perCreator = new Map<string, number>();
    for (const topic of topics) {
      for (const video of topic.videos) {
        if (isPlaceholderVideo(video)) continue;
        perCreator.set(video.creator, (perCreator.get(video.creator) ?? 0) + 1);
      }
    }
    for (const [creator, count] of perCreator) {
      if (count > MAX_PER_CREATOR) {
        errors.push(`${creator} appears ${count} times across the pathway (max ${MAX_PER_CREATOR})`);
      }
    }

    for (const topic of topics) {
      if (topic.tier !== "open_question") continue;
      const creators = new Set(
        topic.videos.filter((v) => !isPlaceholderVideo(v)).map((v) => v.creator),
      );
      if (creators.size < 2) {
        errors.push(
          `${topic.slug}: open_question topics need at least two views from different creators`,
        );
      }
    }
  }

  return errors;
}

export function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

// ---------- accessors used by the pages ----------

const data = rawData as StartHereData;

export function startHereTopics(): StartHereTopic[] {
  return [...data.topics].sort((a, b) => a.order - b.order);
}

export function getStartHereTopic(slug: string): StartHereTopic | null {
  return data.topics.find((topic) => topic.slug === slug) ?? null;
}
