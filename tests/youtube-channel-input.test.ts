import { describe, expect, it } from "vitest";
import { canonicalChannelInput, parseChannelInput } from "@/lib/youtube-api";

const UC_ID = "UCbGZKLIHpox2l0whIkIrDOA";

describe("parseChannelInput", () => {
  it("accepts UC… ids directly", () => {
    expect(parseChannelInput(UC_ID)).toEqual({ kind: "id", value: UC_ID });
  });

  it("accepts @handles and bare handles", () => {
    expect(parseChannelInput("@MikeWinger")).toEqual({ kind: "handle", value: "MikeWinger" });
    expect(parseChannelInput("MikeWinger")).toEqual({ kind: "handle", value: "MikeWinger" });
    expect(parseChannelInput("  @MikeWinger  ")).toEqual({ kind: "handle", value: "MikeWinger" });
  });

  it("accepts handle URLs, with tabs and query strings", () => {
    for (const url of [
      "https://www.youtube.com/@MikeWinger",
      "https://www.youtube.com/@MikeWinger/featured",
      "http://m.youtube.com/@MikeWinger/videos?view=0",
      "youtube.com/@MikeWinger",
    ]) {
      expect(parseChannelInput(url)).toEqual({ kind: "handle", value: "MikeWinger" });
    }
  });

  it("accepts /channel/UC… URLs", () => {
    expect(parseChannelInput(`https://www.youtube.com/channel/${UC_ID}`)).toEqual({
      kind: "id",
      value: UC_ID,
    });
    expect(parseChannelInput(`https://www.youtube.com/channel/${UC_ID}/videos`)).toEqual({
      kind: "id",
      value: UC_ID,
    });
  });

  it("accepts legacy /user/ and /c/ URLs", () => {
    expect(parseChannelInput("https://www.youtube.com/user/SomeName")).toEqual({
      kind: "username",
      value: "SomeName",
    });
    expect(parseChannelInput("https://www.youtube.com/c/SomeName")).toEqual({
      kind: "handle",
      value: "SomeName",
    });
  });

  it("rejects unparseable input", () => {
    expect(parseChannelInput("")).toBeNull();
    expect(parseChannelInput("   ")).toBeNull();
    expect(parseChannelInput("@")).toBeNull();
    expect(parseChannelInput("https://vimeo.com/somebody")).toBeNull();
    expect(parseChannelInput("https://www.youtube.com/watch?v=abc123")).toBeNull();
  });
});

describe("canonicalChannelInput", () => {
  it("canonicalizes to UC id or @handle", () => {
    expect(canonicalChannelInput(`https://www.youtube.com/channel/${UC_ID}`)).toBe(UC_ID);
    expect(
      canonicalChannelInput("https://www.youtube.com/@MikeWinger/featured"),
    ).toBe("@MikeWinger");
    expect(canonicalChannelInput("MikeWinger")).toBe("@MikeWinger");
  });

  it("keeps legacy /user/ URLs as-is and rejects garbage", () => {
    expect(canonicalChannelInput("https://www.youtube.com/user/SomeName")).toBe(
      "https://www.youtube.com/user/SomeName",
    );
    expect(canonicalChannelInput("https://vimeo.com/x")).toBeNull();
  });
});
