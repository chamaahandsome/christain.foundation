// Start Here pathway — loader + validator for content/start-here.json.
// The JSON is hand-curated editorial content; this module is the contract
// the build depends on. Validation rules come from the feature spec:
//
// Structural (always enforced):
//   - unique topic slugs and orders; orders contiguous from 1
//   - `next` chains topics in order; only the last topic has next: null
//   - 3–6 videos per topic; unique video `order` within a topic
//   - tier is `essential` or `open_question`
//   - optional playlists (series): each 2–24 videos, no video twice, a
//     title, a position of "first" or "last" when one is given, and no
//     playlist listed twice in the same topic
//
// Content (strict mode — enforced once curation begins / before launch):
//   - no remaining "REPLACE" placeholders, valid youtube ids, durations > 0
//     (for a playlist's videos too, plus a youtube.com channel link)
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

/** One part of a playlist — the series supplies the creator and the "why". */
export interface StartHerePlaylistVideo {
  youtube_id: string;
  title: string;
  duration_seconds: number;
}

/**
 * A series watched in order, one part leading into the next. Curated like
 * everything else here: the parts are copied in, not read live from YouTube,
 * so a change to the source playlist never silently changes the pathway.
 */
export interface StartHerePlaylist {
  title: string;
  creator: string;
  channel_url: string;
  /** The source playlist, linked for credit. */
  youtube_playlist_id: string;
  why_this_one: string;
  videos: StartHerePlaylistVideo[];
  /** Above the picks ("first") or below them ("last", the default). */
  position?: "first" | "last";
}

export type StartHereTier = "essential" | "open_question";

export interface StartHereTopic {
  slug: string;
  /** Short name for the progress pills, e.g. "The resurrection". */
  label: string;
  /** Optional card art: an absolute URL or a /public path (e.g. "/covers/jesus.jpg").
   * Falls back to the first curated video's thumbnail, then a mono tile. */
  cover_image?: string | null;
  order: number;
  question: string;
  tier: StartHereTier;
  tier_note: string;
  framing: string;
  next: string | null;
  videos: StartHereVideo[];
  /**
   * Optional series, in the order they appear: "first" ones above the picks,
   * the rest below. Not counted against MIN/MAX_VIDEOS.
   */
  playlists?: StartHerePlaylist[];
}

export interface StartHereData {
  topics: StartHereTopic[];
}

export const PLACEHOLDER = "REPLACE";
export const MIN_VIDEOS = 3;
export const MAX_VIDEOS = 6;
export const MAX_PER_CREATOR = 4;
export const MIN_PLAYLIST_VIDEOS = 2;
// Long enough for a full teaching series (Winger's Evidence for the Bible
// runs to 20), short enough to still read as one card.
export const MAX_PLAYLIST_VIDEOS = 24;

export function isPlaceholderVideo(video: StartHereVideo): boolean {
  return (
    video.youtube_id === PLACEHOLDER ||
    video.title === PLACEHOLDER ||
    video.creator === PLACEHOLDER ||
    video.why_this_one === PLACEHOLDER
  );
}

/** A topic's series, in the order they were curated (none → empty). */
export function topicPlaylists(topic: StartHereTopic): StartHerePlaylist[] {
  return topic.playlists ?? [];
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
    if (!topic.label || topic.label.length > 24) {
      errors.push(`${topic.slug}: label must be 1–24 chars (pill text)`);
    }
    if (
      topic.cover_image &&
      !topic.cover_image.startsWith("/") &&
      !topic.cover_image.startsWith("https://")
    ) {
      errors.push(`${topic.slug}: cover_image must be a /public path or https:// URL`);
    }
    // A topic may carry several series; each error names the one at fault.
    const playlistIds = new Set<string>();
    for (const playlist of topicPlaylists(topic)) {
      const named = `"${playlist.title}"`;
      if (!playlist.title.trim()) {
        errors.push(`${topic.slug}: playlist needs a title`);
      }
      if (playlistIds.has(playlist.youtube_playlist_id)) {
        errors.push(`${topic.slug}: playlist ${playlist.youtube_playlist_id} is listed twice`);
      }
      playlistIds.add(playlist.youtube_playlist_id);
      if (
        playlist.position !== undefined &&
        playlist.position !== "first" &&
        playlist.position !== "last"
      ) {
        errors.push(`${topic.slug}: playlist position must be "first" or "last" (${named})`);
      }
      const count = playlist.videos.length;
      if (count < MIN_PLAYLIST_VIDEOS || count > MAX_PLAYLIST_VIDEOS) {
        errors.push(
          `${topic.slug}: playlist has ${count} videos (must be ${MIN_PLAYLIST_VIDEOS}–${MAX_PLAYLIST_VIDEOS}) (${named})`,
        );
      }
      const seen = new Set<string>();
      for (const part of playlist.videos) {
        if (seen.has(part.youtube_id)) {
          errors.push(`${topic.slug}: playlist repeats video ${part.youtube_id} (${named})`);
        }
        seen.add(part.youtube_id);
      }
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

    for (const topic of topics) {
      for (const playlist of topicPlaylists(topic)) {
        const named = `"${playlist.title}"`;
        if (!playlist.channel_url.startsWith("https://www.youtube.com/")) {
          errors.push(`${topic.slug}: playlist channel_url must be a youtube.com channel link (${named})`);
        }
        if (!playlist.why_this_one.trim() || playlist.why_this_one === PLACEHOLDER) {
          errors.push(`${topic.slug}: playlist needs a why_this_one (${named})`);
        }
        playlist.videos.forEach((part, i) => {
          if (!isValidYouTubeId(part.youtube_id)) {
            errors.push(`${topic.slug}: playlist part ${i + 1} has invalid youtube_id "${part.youtube_id}" (${named})`);
          }
          if (part.duration_seconds <= 0) {
            errors.push(`${topic.slug}: playlist part ${i + 1} has no duration (${named})`);
          }
        });
      }
    }

    // curation constraints
    const perCreator = new Map<string, number>();
    for (const topic of topics) {
      for (const video of topic.videos) {
        if (isPlaceholderVideo(video)) continue;
        perCreator.set(video.creator, (perCreator.get(video.creator) ?? 0) + 1);
      }
      // Each series counts once toward its creator's share, however long.
      for (const playlist of topicPlaylists(topic)) {
        perCreator.set(playlist.creator, (perCreator.get(playlist.creator) ?? 0) + 1);
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

/** The part after `index`, or null once the series is done. */
export function nextPlaylistIndex(index: number, length: number): number | null {
  return index + 1 < length ? index + 1 : null;
}

/** Total running time of a series. */
export function playlistDuration(playlist: StartHerePlaylist): number {
  return playlist.videos.reduce((sum, part) => sum + Math.max(0, part.duration_seconds), 0);
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

/** Card-style duration: "42 min", "1 h 5 min". */
export function formatDurationCoarse(totalSeconds: number): string {
  if (totalSeconds <= 0) return "";
  const totalMinutes = Math.max(1, Math.round(totalSeconds / 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

// ---------- accessors used by the pages ----------

const data = rawData as StartHereData;

export function startHereTopics(): StartHereTopic[] {
  return [...data.topics].sort((a, b) => a.order - b.order);
}

export function getStartHereTopic(slug: string): StartHereTopic | null {
  return data.topics.find((topic) => topic.slug === slug) ?? null;
}
