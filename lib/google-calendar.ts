// Google Calendar for online 1:1 sessions (the Maltivas bagel-break move,
// without the googleapis dependency — the REST API over fetch, the same way
// lib/youtube-api talks to YouTube).
//
// Two levels, and the second always works:
//
// 1. A real calendar event on the creator's primary calendar, with a Google
//    Meet link minted by `conferenceData` and invites sent to both parties.
//    Needs the creator's Google OAuth token from Clerk, carrying the
//    calendar.events scope. Best effort: if Google is not connected, the
//    scope is missing, or the API is down, booking still succeeds.
// 2. An "add to Google Calendar" template URL, which is a plain link that
//    needs no OAuth at all and rides along in every confirmation email.
//
// Times are never converted. A slot is wall clock in the service's own
// timezone (lib/availability's rule), and Google accepts exactly that:
// a local `dateTime` plus an IANA `timeZone`. There is no offset math here
// and there should never be any.

import { clerkClient } from "@clerk/nextjs/server";

const pad2 = (n: number) => String(n).padStart(2, "0");

/** 570 → "09:30" — the local clock Google is handed. */
export function hhmm(minutes: number): string {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

/** "2026-09-10" + 570 → "2026-09-10T09:30:00" (local, no zone suffix). */
export function localDateTime(ymd: string, minutes: number): string {
  return `${ymd}T${hhmm(minutes)}:00`;
}

/** "2026-09-10" + 570 → "20260910T093000" — the template URL's stamp. */
export function calendarStamp(ymd: string, minutes: number): string {
  return `${ymd.replace(/-/g, "")}T${hhmm(minutes).replace(":", "")}00`;
}

/**
 * The "add to Google Calendar" link. Pure, needs no credentials, and works
 * for the guest as well as the creator — so every confirmation email can
 * carry one whether or not the API call above succeeded.
 */
export function googleCalendarTemplateUrl(input: {
  title: string;
  details?: string;
  location?: string;
  ymd: string;
  startMin: number;
  endMin: number;
  timezone: string;
}): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${calendarStamp(input.ymd, input.startMin)}/${calendarStamp(
      input.ymd,
      input.endMin,
    )}`,
    ctz: input.timezone || "UTC",
  });
  if (input.details) params.set("details", input.details);
  if (input.location) params.set("location", input.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** The creator's Google OAuth token, held by Clerk. Null when unavailable. */
export async function googleAccessToken(clerkUserId: string): Promise<string | null> {
  try {
    const client = await clerkClient();
    const tokens = await client.users.getUserOauthAccessToken(clerkUserId, "google");
    return tokens.data[0]?.token ?? null;
  } catch {
    // No Google account connected, or Clerk isn't configured — the caller
    // falls back to the creator's standing room.
    return null;
  }
}

export interface CalendarEventResult {
  /** the Google Meet link, when the conference request succeeded */
  meetingUrl: string | null;
  eventId: string | null;
  /** opens the event in the creator's own calendar */
  htmlLink: string | null;
}

/**
 * Create the event (with a Meet conference) on the creator's primary
 * calendar and invite the guest. Returns nulls rather than throwing — a
 * confirmed booking must never be lost to a calendar outage.
 */
export async function createMeetEvent(input: {
  accessToken: string;
  summary: string;
  description?: string;
  ymd: string;
  startMin: number;
  endMin: number;
  timezone: string;
  /** creator first, guest second — both are invited */
  attendees: string[];
  /** idempotency handle for the conference request */
  requestKey: string;
}): Promise<CalendarEventResult> {
  const empty: CalendarEventResult = { meetingUrl: null, eventId: null, htmlLink: null };
  const timeZone = input.timezone || "UTC";
  try {
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events" +
        "?conferenceDataVersion=1&sendUpdates=all",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${input.accessToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          summary: input.summary,
          description: input.description ?? "",
          start: { dateTime: localDateTime(input.ymd, input.startMin), timeZone },
          end: { dateTime: localDateTime(input.ymd, input.endMin), timeZone },
          attendees: input.attendees
            .filter((e) => e.includes("@"))
            .map((email) => ({ email })),
          conferenceData: {
            createRequest: {
              requestId: input.requestKey,
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        }),
      },
    );
    if (!res.ok) {
      console.error(`google calendar: events.insert failed (${res.status})`);
      return empty;
    }
    const json = (await res.json()) as {
      id?: string;
      hangoutLink?: string;
      htmlLink?: string;
      conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
    };
    const entry = json.conferenceData?.entryPoints?.find(
      (p) => p.entryPointType === "video" && typeof p.uri === "string",
    );
    return {
      meetingUrl: json.hangoutLink ?? entry?.uri ?? null,
      eventId: json.id ?? null,
      htmlLink: json.htmlLink ?? null,
    };
  } catch (err) {
    console.error("google calendar: events.insert threw —", err);
    return empty;
  }
}

/** Cancel the calendar event when a session is called off. Best effort. */
export async function deleteCalendarEvent(input: {
  accessToken: string;
  eventId: string;
}): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(
        input.eventId,
      )}?sendUpdates=all`,
      { method: "DELETE", headers: { authorization: `Bearer ${input.accessToken}` } },
    );
    // 410 = already gone, which is the outcome we wanted anyway.
    return res.ok || res.status === 410;
  } catch {
    return false;
  }
}
