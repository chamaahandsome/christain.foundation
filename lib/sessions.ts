// Online 1:1 sessions (pure rules, tested) — the Maltivas bagel-break
// "appointment" event, expressed in CF's booking vocabulary.
//
// A session is a BookableService with kind = ONLINE. It always books by
// slot (one slot per booking, unlike hire services which can take a run of
// them), it is either free or a fixed fee, and confirming it issues a
// meeting link rather than drafting a contract.

import { formatMin } from "@/lib/availability";

export const SESSION_CATEGORIES = [
  "mentoring",
  "discipleship",
  "prayer",
  "counsel",
  "consultation",
  "teaching",
  "other",
] as const;

export type SessionCategory = (typeof SESSION_CATEGORIES)[number];

/** Slot lengths a 1:1 is offered in. */
export const SESSION_DURATIONS = [15, 20, 30, 45, 60, 90] as const;

/**
 * How long an unpaid session holds its slot. Short by design: a hire
 * request holds for a week because a human is deciding, but a session is
 * only waiting on a card, and every minute of hold is a slot nobody else
 * can take.
 */
export const SESSION_HOLD_MINUTES = 30;

/** No fee, or a fee of zero — booked without going near Stripe. */
export function sessionIsFree(rateCents: number | null | undefined): boolean {
  return rateCents === null || rateCents === undefined || rateCents <= 0;
}

export interface SessionDraft {
  title: string;
  description: string;
  slotMinutes: number | null;
  dailyStart: string | null;
  dailyEnd: string | null;
  rateCents?: number | null;
  meetingProvider?: string;
  meetingUrl?: string | null;
}

/**
 * Validate a creator's 1:1 before it is saved. Returns the message to show,
 * or null when the draft is sound.
 */
export function validateSessionDraft(draft: SessionDraft): string | null {
  if (draft.title.trim().length < 2) return "Name the session.";
  if (draft.description.trim().length < 10) {
    return "Describe what the session is for — a sentence at least.";
  }
  if (!draft.slotMinutes || draft.slotMinutes < 5 || draft.slotMinutes > 480) {
    return "Pick how long each session runs.";
  }
  const start = draft.dailyStart ? toMinutes(draft.dailyStart) : null;
  const end = draft.dailyEnd ? toMinutes(draft.dailyEnd) : null;
  if (start === null || end === null) {
    return "Set the hours you take these meetings.";
  }
  if (end <= start) return "The finish time must be after the start time.";
  if (end - start < draft.slotMinutes) {
    return "That window is shorter than one session.";
  }
  if (
    draft.rateCents !== undefined &&
    draft.rateCents !== null &&
    (!Number.isInteger(draft.rateCents) || draft.rateCents < 0)
  ) {
    return "The fee must be a positive amount, or left blank for free.";
  }
  if (draft.meetingProvider === "custom" && !isHttpsUrl(draft.meetingUrl)) {
    return "Paste the https link to your meeting room.";
  }
  if (draft.meetingUrl && !isHttpsUrl(draft.meetingUrl)) {
    return "The meeting link must be an https address.";
  }
  return null;
}

function toMinutes(value: string): number | null {
  const m = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function isHttpsUrl(value: string | null | undefined): boolean {
  return typeof value === "string" && /^https:\/\/\S+$/i.test(value.trim());
}

/** "Tue, 10 Sep · 9:00 AM – 9:30 AM (America/Chicago)" — one readable line. */
export function sessionWhen(input: {
  ymd: string;
  startMin: number;
  endMin: number;
  timezone: string;
  locale?: string;
}): string {
  const day = new Date(`${input.ymd}T12:00:00Z`).toLocaleDateString(input.locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return (
    `${day} · ${formatMin(input.startMin)} – ${formatMin(input.endMin)}` +
    ` (${input.timezone || "UTC"})`
  );
}

/**
 * Which meeting link a confirmed booking should carry. The Google Meet link
 * wins when one was minted; the creator's standing room is the fallback;
 * null means the creator will send one by hand.
 */
export function resolveMeetingUrl(input: {
  googleMeetUrl?: string | null;
  serviceMeetingUrl?: string | null;
}): string | null {
  const meet = input.googleMeetUrl?.trim();
  if (meet) return meet;
  const room = input.serviceMeetingUrl?.trim();
  return room ? room : null;
}

/** Whether a session that has already started (or passed) can still be joined. */
export function sessionIsPast(input: {
  ymd: string;
  endMin: number;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  const dayMs = Date.parse(`${input.ymd}T00:00:00Z`);
  if (Number.isNaN(dayMs)) return false;
  // Wall clock in the service's zone is compared against UTC deliberately:
  // this is only used to grey out finished sessions in a list, and the
  // worst case is a few hours' lag on the label.
  return dayMs + input.endMin * 60_000 < now.getTime();
}
