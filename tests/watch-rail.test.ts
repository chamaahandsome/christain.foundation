import { describe, expect, it } from "vitest";
import {
  RAIL_MAX_TAKE,
  RAIL_PAGE_SIZE,
  formatRuntime,
  pageWithCursor,
  parseRailQuery,
  railWhere,
} from "@/lib/watch-rail";

const CH = "cmf1channel0001";
const q = (search: string) => parseRailQuery(new URLSearchParams(search));

describe("parseRailQuery", () => {
  it("reads a first page with the defaults", () => {
    expect(q(`channelId=${CH}`)).toEqual({
      channelId: CH,
      cursor: null,
      excludeId: null,
      take: RAIL_PAGE_SIZE,
    });
  });

  it("carries the cursor and the video being watched", () => {
    expect(q(`channelId=${CH}&cursor=cmf1item00002&exclude=cmf1item00001`)).toMatchObject({
      cursor: "cmf1item00002",
      excludeId: "cmf1item00001",
    });
  });

  it("clamps the page size", () => {
    expect(q(`channelId=${CH}&take=500`)).toMatchObject({ take: RAIL_MAX_TAKE });
    expect(q(`channelId=${CH}&take=0`)).toMatchObject({ take: 1 });
    expect(q(`channelId=${CH}&take=abc`)).toMatchObject({ take: RAIL_PAGE_SIZE });
  });

  it("refuses anything that isn't an id before it reaches the database", () => {
    expect(q("")).toHaveProperty("error");
    expect(q("channelId=x")).toHaveProperty("error");
    expect(q(`channelId=${CH}&cursor=' OR 1=1`)).toHaveProperty("error");
    expect(q(`channelId=${CH}&exclude=../../etc`)).toHaveProperty("error");
  });
});

describe("pageWithCursor", () => {
  const rows = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `item${String(i).padStart(6, "0")}` }));

  it("trims the lookahead row and resumes after the last one shown", () => {
    const out = pageWithCursor(rows(4), 3);
    expect(out.items.map((r) => r.id)).toEqual(["item000000", "item000001", "item000002"]);
    expect(out.nextCursor).toBe("item000002");
  });

  it("ends the rail when there is no lookahead", () => {
    expect(pageWithCursor(rows(3), 3).nextCursor).toBeNull();
    expect(pageWithCursor([], 3)).toEqual({ items: [], nextCursor: null });
  });
});

describe("railWhere", () => {
  it("keeps to the channel's live, approved embeds and leaves out what's playing", () => {
    expect(railWhere(CH, "cmf1item00001")).toEqual({
      channelId: CH,
      unavailableAt: null,
      youtubeVideoId: { not: null },
      channel: { status: "APPROVED" },
      id: { not: "cmf1item00001" },
    });
    expect(railWhere(CH, null)).not.toHaveProperty("id");
  });
});

describe("formatRuntime", () => {
  it("reads like YouTube's duration badge", () => {
    expect(formatRuntime(59)).toBe("0:59");
    expect(formatRuntime(754)).toBe("12:34");
    expect(formatRuntime(3723)).toBe("1:02:03");
  });

  it("shows nothing for an unknown length", () => {
    expect(formatRuntime(null)).toBeNull();
    expect(formatRuntime(0)).toBeNull();
  });
});
