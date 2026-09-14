// Start Here analytics — the browser side.
//
// A visitor is a random id kept on this device (no name, email or
// fingerprint). Events go out with sendBeacon so the page never waits, and
// nothing is sent at all when the browser asks not to be tracked.

import type { StartHereEventType } from "@/lib/start-here-analytics";

const VISITOR_KEY = "start-here:visitor";
const ENDPOINT = "/api/start-here/events";

let memoryId: string | null = null;

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    const part = () => Math.random().toString(36).slice(2, 12);
    return `${Date.now().toString(36)}-${part()}-${part()}`;
  }
}

/** This device's anonymous id — kept in storage, or for the visit if storage refuses. */
function visitorId(): string {
  try {
    const saved = localStorage.getItem(VISITOR_KEY);
    if (saved) return saved;
    const id = newId();
    localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    memoryId ??= newId();
    return memoryId;
  }
}

function doNotTrack(): boolean {
  try {
    const nav = navigator as Navigator & { doNotTrack?: string };
    const win = window as Window & { doNotTrack?: string };
    return nav.doNotTrack === "1" || win.doNotTrack === "1";
  } catch {
    return false;
  }
}

export function trackStartHere(event: {
  type: StartHereEventType;
  stepSlug: string;
  /** "video:<youtubeId>" or "series:<playlistId>", for plays */
  itemKey?: string;
}): void {
  if (typeof window === "undefined" || doNotTrack()) return;
  const body = JSON.stringify({ ...event, visitorId: visitorId() });
  try {
    if (navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) return;
  } catch {
    // fall through to fetch
  }
  fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}
