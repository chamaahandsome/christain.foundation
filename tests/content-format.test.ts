import { describe, expect, it } from "vitest";
import { classifyFormat, parsePlaylistsResponse } from "@/lib/youtube-api";

const base = { wasLive: false, durationSec: 600, title: "Teaching", description: "" };

describe("classifyFormat", () => {
  it("marks archived live streams as LIVE regardless of length", () => {
    expect(classifyFormat({ ...base, wasLive: true, durationSec: 45 })).toBe("LIVE");
    expect(classifyFormat({ ...base, wasLive: true, durationSec: 7200 })).toBe("LIVE");
  });

  it("marks a minute or under as SHORT", () => {
    expect(classifyFormat({ ...base, durationSec: 58 })).toBe("SHORT");
    expect(classifyFormat({ ...base, durationSec: 63 })).toBe("SHORT");
  });

  it("marks 1–3 minutes as SHORT only when tagged #shorts", () => {
    expect(classifyFormat({ ...base, durationSec: 120 })).toBe("STANDARD");
    expect(
      classifyFormat({ ...base, durationSec: 120, title: "Quick word #shorts" }),
    ).toBe("SHORT");
    expect(
      classifyFormat({ ...base, durationSec: 120, description: "clip #Short" }),
    ).toBe("SHORT");
    expect(classifyFormat({ ...base, durationSec: 200, title: "#shorts" })).toBe(
      "STANDARD",
    );
  });

  it("leaves normal videos STANDARD, including unknown durations", () => {
    expect(classifyFormat(base)).toBe("STANDARD");
    expect(classifyFormat({ ...base, durationSec: null })).toBe("STANDARD");
    expect(classifyFormat({ ...base, durationSec: 0 })).toBe("STANDARD");
  });
});

describe("parsePlaylistsResponse", () => {
  it("parses playlists with counts and paging", () => {
    const parsed = parsePlaylistsResponse({
      items: [
        {
          id: "PL123",
          snippet: { title: "Romans", description: "Verse by verse" },
          contentDetails: { itemCount: 12 },
        },
        { snippet: { title: "no id, dropped" } },
      ],
      nextPageToken: "abc",
    });
    expect(parsed.playlists).toEqual([
      { playlistId: "PL123", title: "Romans", description: "Verse by verse", itemCount: 12 },
    ]);
    expect(parsed.nextPageToken).toBe("abc");
  });

  it("handles empty responses", () => {
    expect(parsePlaylistsResponse({})).toEqual({ playlists: [], nextPageToken: null });
  });
});
