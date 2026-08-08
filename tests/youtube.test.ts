import { describe, expect, it } from "vitest";
import {
  buildEmbedUrl,
  extractYouTubeId,
  isValidYouTubeId,
  parseIsoDuration,
  thumbnailUrl,
} from "@/lib/youtube";

const ID = "dQw4w9WgXcQ";

describe("extractYouTubeId", () => {
  it("accepts a bare video id", () => {
    expect(extractYouTubeId(ID)).toBe(ID);
  });

  it.each([
    [`https://www.youtube.com/watch?v=${ID}`],
    [`https://youtube.com/watch?v=${ID}&t=42s`],
    [`https://m.youtube.com/watch?v=${ID}`],
    [`https://youtu.be/${ID}`],
    [`https://youtu.be/${ID}?si=share-junk`],
    [`https://www.youtube.com/shorts/${ID}`],
    [`https://www.youtube.com/embed/${ID}`],
    [`https://www.youtube.com/live/${ID}`],
    [`https://www.youtube-nocookie.com/embed/${ID}`],
  ])("extracts from %s", (url) => {
    expect(extractYouTubeId(url)).toBe(ID);
  });

  it.each([
    ["not a url at all"],
    ["https://vimeo.com/12345678"],
    ["https://www.youtube.com/watch"],
    ["https://www.youtube.com/watch?v=too-short"],
    ["https://evil.com/watch?v=dQw4w9WgXcQ"],
    [""],
  ])("rejects %s", (input) => {
    expect(extractYouTubeId(input)).toBeNull();
  });
});

describe("isValidYouTubeId", () => {
  it("accepts an 11-char id", () => {
    expect(isValidYouTubeId(ID)).toBe(true);
  });
  it("rejects wrong lengths and characters", () => {
    expect(isValidYouTubeId("short")).toBe(false);
    expect(isValidYouTubeId("has spaces!")).toBe(false);
    expect(isValidYouTubeId(ID + "x")).toBe(false);
  });
});

describe("buildEmbedUrl", () => {
  it("uses the privacy-enhanced host with rel=0 and the js api enabled", () => {
    const url = new URL(buildEmbedUrl(ID));
    expect(url.hostname).toBe("www.youtube-nocookie.com");
    expect(url.pathname).toBe(`/embed/${ID}`);
    expect(url.searchParams.get("rel")).toBe("0");
    expect(url.searchParams.get("enablejsapi")).toBe("1");
    expect(url.searchParams.get("autoplay")).toBeNull();
  });

  it("supports resume position and autoplay", () => {
    const url = new URL(buildEmbedUrl(ID, { startSec: 90.9, autoplay: true }));
    expect(url.searchParams.get("start")).toBe("90");
    expect(url.searchParams.get("autoplay")).toBe("1");
  });

  it("omits start for zero", () => {
    const url = new URL(buildEmbedUrl(ID, { startSec: 0 }));
    expect(url.searchParams.get("start")).toBeNull();
  });

  it("throws on an invalid id", () => {
    expect(() => buildEmbedUrl("nope")).toThrow();
  });
});

describe("thumbnailUrl", () => {
  it("builds the ytimg url", () => {
    expect(thumbnailUrl(ID)).toBe(`https://i.ytimg.com/vi/${ID}/hqdefault.jpg`);
    expect(thumbnailUrl(ID, "maxresdefault")).toBe(
      `https://i.ytimg.com/vi/${ID}/maxresdefault.jpg`,
    );
  });
  it("throws on an invalid id", () => {
    expect(() => thumbnailUrl("bad id")).toThrow();
  });
});

describe("parseIsoDuration", () => {
  it.each([
    ["PT1H2M3S", 3723],
    ["PT45M", 2700],
    ["PT30S", 30],
    ["PT2H", 7200],
    ["PT1H0M10S", 3610],
  ])("parses %s to %d seconds", (iso, expected) => {
    expect(parseIsoDuration(iso)).toBe(expected);
  });

  it("rejects malformed durations", () => {
    expect(parseIsoDuration("PT")).toBeNull();
    expect(parseIsoDuration("1:02:03")).toBeNull();
    expect(parseIsoDuration("")).toBeNull();
  });
});
