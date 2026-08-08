// Embedded-library helpers (concept §8: the free library is embedded, not
// hosted — official YouTube player, our surface around it).

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function isValidYouTubeId(id: string): boolean {
  return YOUTUBE_ID_PATTERN.test(id);
}

/**
 * Extract a YouTube video id from any of the common URL shapes, or from a
 * bare id. Returns null when nothing valid is found.
 */
export function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (isValidYouTubeId(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\.|^m\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return isValidYouTubeId(id) ? id : null;
  }

  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    // /watch?v=<id>
    const v = url.searchParams.get("v");
    if (v && isValidYouTubeId(v)) return v;

    // /shorts/<id>, /embed/<id>, /live/<id>, /v/<id>
    const match = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?]+)/);
    if (match && isValidYouTubeId(match[1])) return match[1];
  }

  return null;
}

/**
 * Build the embed URL for the CF watch surface.
 * - privacy-enhanced host (youtube-nocookie.com)
 * - rel=0 limits end-screen suggestions to the same channel (YouTube does not
 *   allow removing them entirely — we control around the player, not inside it)
 * - enablejsapi=1 so the iframe API can report playback events for
 *   continue-watching and analytics
 */
export function buildEmbedUrl(
  videoId: string,
  opts: { startSec?: number; autoplay?: boolean } = {},
): string {
  if (!isValidYouTubeId(videoId)) {
    throw new Error(`Invalid YouTube video id: ${videoId}`);
  }
  const params = new URLSearchParams({ rel: "0", enablejsapi: "1" });
  if (opts.startSec && opts.startSec > 0) {
    params.set("start", String(Math.floor(opts.startSec)));
  }
  if (opts.autoplay) params.set("autoplay", "1");
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

export function thumbnailUrl(
  videoId: string,
  quality: "default" | "mqdefault" | "hqdefault" | "maxresdefault" = "hqdefault",
): string {
  if (!isValidYouTubeId(videoId)) {
    throw new Error(`Invalid YouTube video id: ${videoId}`);
  }
  return `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
}

/** Parse ISO-8601 durations as returned by the YouTube Data API (PT1H2M3S). */
export function parseIsoDuration(iso: string): number | null {
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match || (!match[1] && !match[2] && !match[3])) return null;
  const [, h, m, s] = match;
  return (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);
}
