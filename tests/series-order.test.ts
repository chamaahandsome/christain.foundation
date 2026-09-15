import { describe, expect, it } from "vitest";
import {
  SERIES_UP_NEXT_MAX,
  playlistPositions,
  positionUpdates,
  seriesUpNext,
} from "@/lib/series-order";

describe("playlistPositions", () => {
  it("numbers the playlist in the creator's order", () => {
    expect([...playlistPositions(["c", "a", "b"])]).toEqual([
      ["c", 0],
      ["a", 1],
      ["b", 2],
    ]);
  });

  it("keeps a video's first place when the playlist lists it twice", () => {
    expect(playlistPositions(["a", "b", "a"]).get("a")).toBe(0);
  });
});

describe("positionUpdates", () => {
  const positions = playlistPositions(["v2", "v1", "v3"]);

  it("gives each video its place in the playlist", () => {
    expect(
      positionUpdates(
        [
          { id: "i1", youtubeVideoId: "v1", seriesPosition: null },
          { id: "i2", youtubeVideoId: "v2", seriesPosition: null },
        ],
        positions,
      ),
    ).toEqual([
      { id: "i1", seriesPosition: 1 },
      { id: "i2", seriesPosition: 0 },
    ]);
  });

  it("follows the creator when they reorder, and skips what's already in place", () => {
    expect(
      positionUpdates(
        [
          { id: "i1", youtubeVideoId: "v1", seriesPosition: 0 },
          { id: "i3", youtubeVideoId: "v3", seriesPosition: 2 },
        ],
        positions,
      ),
    ).toEqual([{ id: "i1", seriesPosition: 1 }]);
  });

  it("sends a video no longer in the playlist to the end", () => {
    expect(
      positionUpdates(
        [
          { id: "gone", youtubeVideoId: "v9", seriesPosition: 4 },
          { id: "native", youtubeVideoId: null, seriesPosition: null },
        ],
        positions,
      ),
    ).toEqual([{ id: "gone", seriesPosition: null }]);
  });
});

describe("seriesUpNext", () => {
  const parts = Array.from({ length: 14 }, (_, i) => ({ id: `p${i + 1}` }));

  it("finds the part playing and the parts after it", () => {
    const out = seriesUpNext(parts.slice(0, 6), "p3");
    expect(out.part).toBe(3);
    expect(out.total).toBe(6);
    expect(out.next.map((p) => p.id)).toEqual(["p4", "p5", "p6"]);
    expect(out.first?.id).toBe("p1");
  });

  it("offers only so many next parts", () => {
    expect(seriesUpNext(parts, "p1").next).toHaveLength(SERIES_UP_NEXT_MAX);
  });

  it("has nothing next on the last part", () => {
    const out = seriesUpNext(parts.slice(0, 6), "p6");
    expect(out.part).toBe(6);
    expect(out.next).toEqual([]);
  });

  it("starts from the beginning when the video isn't in the list", () => {
    const out = seriesUpNext(parts.slice(0, 3), "elsewhere");
    expect(out.part).toBeNull();
    expect(out.next.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
  });
});
