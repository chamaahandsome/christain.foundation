import { describe, expect, it } from "vitest";
import {
  SHORTS_MAX_SEC,
  classifyFormat,
  detectFormat,
  parsePlaylistsResponse,
  shortsProbeVerdict,
} from "@/lib/youtube-api";

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

describe("shortsProbeVerdict", () => {
  it("reads 200 as a Short and a redirect to /watch as a regular video", () => {
    expect(shortsProbeVerdict(200, null)).toBe(true);
    expect(shortsProbeVerdict(303, "https://www.youtube.com/watch?v=abc12345678")).toBe(false);
  });

  it("takes nothing else as an answer", () => {
    expect(shortsProbeVerdict(302, "https://consent.youtube.com/m?continue=x")).toBeNull();
    expect(shortsProbeVerdict(303, null)).toBeNull();
    expect(shortsProbeVerdict(429, null)).toBeNull();
    expect(shortsProbeVerdict(404, null)).toBeNull();
  });
});

describe("detectFormat", () => {
  const clip = { videoId: "abc12345678", wasLive: false, durationSec: 45, title: "Clip", description: "" };

  function youtubeAnswering(status: number, location?: string) {
    const calls: string[] = [];
    const fetchImpl = (async (url: string | URL | Request) => {
      calls.push(String(url));
      return new Response(null, { status, headers: location ? { location } : {} });
    }) as typeof fetch;
    return { fetchImpl, calls };
  }

  it("asks YouTube's /shorts address for that video", async () => {
    const yt = youtubeAnswering(200);
    await detectFormat(clip, yt.fetchImpl);
    expect(yt.calls).toEqual(["https://www.youtube.com/shorts/abc12345678"]);
  });

  it("trusts YouTube: a Short is a Short, a short regular video is not", async () => {
    expect(await detectFormat(clip, youtubeAnswering(200).fetchImpl)).toBe("SHORT");
    expect(
      await detectFormat(clip, youtubeAnswering(303, "https://www.youtube.com/watch?v=abc12345678").fetchImpl),
    ).toBe("STANDARD");
  });

  it("catches an untagged Short the heuristic would miss", async () => {
    const untagged = { ...clip, durationSec: 150 };
    expect(classifyFormat(untagged)).toBe("STANDARD");
    expect(await detectFormat(untagged, youtubeAnswering(200).fetchImpl)).toBe("SHORT");
  });

  it("never asks about live archives or anything longer than a Short", async () => {
    const long = youtubeAnswering(200);
    expect(await detectFormat({ ...clip, durationSec: SHORTS_MAX_SEC + 1 }, long.fetchImpl)).toBe("STANDARD");
    const live = youtubeAnswering(200);
    expect(await detectFormat({ ...clip, wasLive: true }, live.fetchImpl)).toBe("LIVE");
    expect(long.calls).toHaveLength(0);
    expect(live.calls).toHaveLength(0);
  });

  it("falls back to the heuristic when YouTube gives no answer", async () => {
    const consent = youtubeAnswering(302, "https://consent.youtube.com/m?continue=x").fetchImpl;
    expect(await detectFormat(clip, consent)).toBe("SHORT"); // 45s: heuristic says Short
    expect(await detectFormat({ ...clip, durationSec: 150 }, consent)).toBe("STANDARD");
    const broken = (async () => {
      throw new Error("network down");
    }) as typeof fetch;
    expect(await detectFormat(clip, broken)).toBe("SHORT");
  });
});
