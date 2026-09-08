import { describe, expect, it } from "vitest";
import {
  calendarStamp,
  googleCalendarTemplateUrl,
  hhmm,
  localDateTime,
} from "@/lib/google-calendar";

describe("clock formatting", () => {
  it("renders minutes-from-midnight as a local clock", () => {
    expect(hhmm(0)).toBe("00:00");
    expect(hhmm(570)).toBe("09:30");
    expect(hhmm(1439)).toBe("23:59");
  });
  it("wraps rather than emitting nonsense", () => {
    expect(hhmm(1440)).toBe("00:00");
    expect(hhmm(-30)).toBe("23:30");
  });
});

describe("localDateTime", () => {
  it("has no zone suffix — the zone travels beside it", () => {
    expect(localDateTime("2026-09-10", 540)).toBe("2026-09-10T09:00:00");
    expect(localDateTime("2026-09-10", 540)).not.toMatch(/Z|[+-]\d\d:\d\d$/);
  });
});

describe("calendarStamp", () => {
  it("packs the day and time the way the template URL wants", () => {
    expect(calendarStamp("2026-09-10", 540)).toBe("20260910T090000");
    expect(calendarStamp("2026-12-31", 1425)).toBe("20261231T234500");
  });
});

describe("googleCalendarTemplateUrl", () => {
  const url = googleCalendarTemplateUrl({
    title: "Discipleship call — Grace Chapel",
    details: "Join: https://meet.google.com/abc",
    ymd: "2026-09-10",
    startMin: 540,
    endMin: 570,
    timezone: "America/Chicago",
  });
  const params = new URL(url).searchParams;

  it("points at Google's render endpoint", () => {
    expect(url.startsWith("https://calendar.google.com/calendar/render?")).toBe(true);
    expect(params.get("action")).toBe("TEMPLATE");
  });
  it("carries the range and the zone, unconverted", () => {
    expect(params.get("dates")).toBe("20260910T090000/20260910T093000");
    expect(params.get("ctz")).toBe("America/Chicago");
  });
  it("round-trips the title and details through encoding", () => {
    expect(params.get("text")).toBe("Discipleship call — Grace Chapel");
    expect(params.get("details")).toBe("Join: https://meet.google.com/abc");
  });
  it("omits what wasn't given, and never leaves the zone blank", () => {
    const bare = new URL(
      googleCalendarTemplateUrl({
        title: "Prayer",
        ymd: "2026-09-10",
        startMin: 540,
        endMin: 570,
        timezone: "",
      }),
    ).searchParams;
    expect(bare.has("details")).toBe(false);
    expect(bare.has("location")).toBe(false);
    expect(bare.get("ctz")).toBe("UTC");
  });
});
