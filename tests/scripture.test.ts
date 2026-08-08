import { describe, expect, it } from "vitest";
import {
  canonicalBookName,
  formatScriptureRef,
  parseScriptureRef,
  parseScriptureRefList,
} from "@/lib/scripture";

describe("canonicalBookName", () => {
  it.each([
    ["john", "John"],
    ["Jn", "John"],
    ["1 cor", "1 Corinthians"],
    ["1cor", "1 Corinthians"],
    ["Rom.", "Romans"],
    ["psalm", "Psalms"],
    ["Song of Songs", "Song of Solomon"],
    ["REVELATION", "Revelation"],
  ])("resolves %s → %s", (input, expected) => {
    expect(canonicalBookName(input)).toBe(expected);
  });

  it("returns null for unknown books", () => {
    expect(canonicalBookName("Hezekiah")).toBeNull();
    expect(canonicalBookName("")).toBeNull();
  });
});

describe("parseScriptureRef", () => {
  it("parses book chapter:verse", () => {
    expect(parseScriptureRef("John 3:16")).toEqual({
      book: "John",
      chapter: 3,
      verseStart: 16,
    });
  });

  it("parses verse ranges (hyphen and en-dash)", () => {
    expect(parseScriptureRef("1 Cor 13:4-7")).toEqual({
      book: "1 Corinthians",
      chapter: 13,
      verseStart: 4,
      verseEnd: 7,
    });
    expect(parseScriptureRef("Rom 8:28–39")).toEqual({
      book: "Romans",
      chapter: 8,
      verseStart: 28,
      verseEnd: 39,
    });
  });

  it("parses chapter-only references", () => {
    expect(parseScriptureRef("Psalm 23")).toEqual({ book: "Psalms", chapter: 23 });
  });

  it("handles abbreviations with periods and extra spaces", () => {
    expect(parseScriptureRef("  Rom.  8 ")).toEqual({ book: "Romans", chapter: 8 });
  });

  it("rejects unknown books, inverted ranges, and garbage", () => {
    expect(parseScriptureRef("Hezekiah 1:1")).toBeNull();
    expect(parseScriptureRef("John 3:16-2")).toBeNull();
    expect(parseScriptureRef("just words")).toBeNull();
    expect(parseScriptureRef("")).toBeNull();
  });
});

describe("formatScriptureRef", () => {
  it("round-trips through parse", () => {
    const cases = ["John 3:16", "1 Corinthians 13:4-7", "Psalms 23"];
    for (const input of cases) {
      const ref = parseScriptureRef(input);
      expect(ref).not.toBeNull();
      expect(formatScriptureRef(ref!)).toBe(input);
    }
  });

  it("collapses a single-verse range", () => {
    expect(
      formatScriptureRef({ book: "John", chapter: 1, verseStart: 1, verseEnd: 1 }),
    ).toBe("John 1:1");
  });
});

describe("parseScriptureRefList", () => {
  it("parses separated lists and drops invalid entries", () => {
    const refs = parseScriptureRefList("John 3:16; Rom 8:28-30, Hezekiah 1:1");
    expect(refs).toEqual([
      { book: "John", chapter: 3, verseStart: 16 },
      { book: "Romans", chapter: 8, verseStart: 28, verseEnd: 30 },
    ]);
  });

  it("returns empty for empty input", () => {
    expect(parseScriptureRefList("")).toEqual([]);
  });
});
