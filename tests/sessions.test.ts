import { describe, expect, it } from "vitest";
import {
  SESSION_HOLD_MINUTES,
  resolveMeetingUrl,
  sessionIsFree,
  sessionIsPast,
  sessionWhen,
  validateSessionDraft,
} from "@/lib/sessions";

const draft = {
  title: "Discipleship call",
  description: "A half hour to talk through where you are.",
  slotMinutes: 30,
  dailyStart: "09:00",
  dailyEnd: "17:00",
};

describe("validateSessionDraft", () => {
  it("accepts a sound draft", () => {
    expect(validateSessionDraft(draft)).toBeNull();
  });

  it("requires a name and a real description", () => {
    expect(validateSessionDraft({ ...draft, title: "x" })).toMatch(/Name the session/);
    expect(validateSessionDraft({ ...draft, description: "short" })).toMatch(
      /Describe what the session is for/,
    );
  });

  it("requires a length and a usable window", () => {
    expect(validateSessionDraft({ ...draft, slotMinutes: null })).toMatch(/how long/);
    expect(validateSessionDraft({ ...draft, dailyStart: null })).toMatch(/hours you take/);
    expect(validateSessionDraft({ ...draft, dailyEnd: "08:00" })).toMatch(
      /after the start time/,
    );
  });

  it("rejects a window shorter than one session", () => {
    expect(
      validateSessionDraft({ ...draft, dailyStart: "09:00", dailyEnd: "09:20" }),
    ).toMatch(/shorter than one session/);
  });

  it("rejects a negative or fractional fee", () => {
    expect(validateSessionDraft({ ...draft, rateCents: -100 })).toMatch(/positive amount/);
    expect(validateSessionDraft({ ...draft, rateCents: 12.5 })).toMatch(/positive amount/);
    expect(validateSessionDraft({ ...draft, rateCents: 0 })).toBeNull();
    expect(validateSessionDraft({ ...draft, rateCents: 2500 })).toBeNull();
  });

  it("insists on an https room link when the creator brings their own", () => {
    expect(
      validateSessionDraft({ ...draft, meetingProvider: "custom", meetingUrl: null }),
    ).toMatch(/https link/);
    expect(
      validateSessionDraft({
        ...draft,
        meetingProvider: "custom",
        meetingUrl: "http://zoom.us/j/1",
      }),
    ).toMatch(/https link/);
    expect(
      validateSessionDraft({
        ...draft,
        meetingProvider: "custom",
        meetingUrl: "https://zoom.us/j/1",
      }),
    ).toBeNull();
  });

  it("still rejects a bad fallback link on a Google Meet session", () => {
    expect(
      validateSessionDraft({
        ...draft,
        meetingProvider: "google_meet",
        meetingUrl: "zoom.us/j/1",
      }),
    ).toMatch(/https address/);
    // No fallback at all is fine — Google supplies the link.
    expect(
      validateSessionDraft({ ...draft, meetingProvider: "google_meet", meetingUrl: null }),
    ).toBeNull();
  });
});

describe("sessionIsFree", () => {
  it("treats null, undefined and zero as free", () => {
    expect(sessionIsFree(null)).toBe(true);
    expect(sessionIsFree(undefined)).toBe(true);
    expect(sessionIsFree(0)).toBe(true);
    expect(sessionIsFree(1)).toBe(false);
  });
});

describe("resolveMeetingUrl", () => {
  it("prefers the Google Meet link, falls back to the standing room", () => {
    expect(
      resolveMeetingUrl({
        googleMeetUrl: "https://meet.google.com/abc",
        serviceMeetingUrl: "https://zoom.us/j/1",
      }),
    ).toBe("https://meet.google.com/abc");
    expect(
      resolveMeetingUrl({ googleMeetUrl: null, serviceMeetingUrl: "https://zoom.us/j/1" }),
    ).toBe("https://zoom.us/j/1");
    expect(resolveMeetingUrl({ googleMeetUrl: "  ", serviceMeetingUrl: "  " })).toBeNull();
    expect(resolveMeetingUrl({})).toBeNull();
  });
});

describe("sessionWhen", () => {
  it("reads as one line, with the zone stated", () => {
    expect(
      sessionWhen({
        ymd: "2026-09-10",
        startMin: 540,
        endMin: 570,
        timezone: "America/Chicago",
        locale: "en-US",
      }),
    ).toBe("Thu, Sep 10 · 9:00 AM – 9:30 AM (America/Chicago)");
  });
  it("never leaves the zone blank", () => {
    expect(
      sessionWhen({ ymd: "2026-09-10", startMin: 0, endMin: 30, timezone: "" }),
    ).toContain("(UTC)");
  });
});

describe("sessionIsPast", () => {
  const now = new Date("2026-09-10T12:00:00Z");
  it("is past once the end time has gone", () => {
    expect(sessionIsPast({ ymd: "2026-09-10", endMin: 660, now })).toBe(true);
    expect(sessionIsPast({ ymd: "2026-09-10", endMin: 780, now })).toBe(false);
    expect(sessionIsPast({ ymd: "2026-09-09", endMin: 1439, now })).toBe(true);
    expect(sessionIsPast({ ymd: "2026-09-11", endMin: 0, now })).toBe(false);
  });
  it("shrugs at a malformed day", () => {
    expect(sessionIsPast({ ymd: "not-a-day", endMin: 60, now })).toBe(false);
  });
});

describe("SESSION_HOLD_MINUTES", () => {
  it("is short — a held slot is one nobody else can take", () => {
    expect(SESSION_HOLD_MINUTES).toBeLessThanOrEqual(60);
    expect(SESSION_HOLD_MINUTES).toBeGreaterThan(0);
  });
});
