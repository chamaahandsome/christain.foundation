import { describe, expect, it } from "vitest";
import { suggestHandle, validateHandle } from "@/lib/handles";

describe("validateHandle", () => {
  it.each([["gracechapel"], ["john.piper"], ["team_cf1"], ["abc"]])(
    "accepts %s",
    (handle) => {
      expect(validateHandle(handle).valid).toBe(true);
    },
  );

  it.each([
    ["ab", "too short"],
    ["a".repeat(31), "too long"],
    ["Uppercase", "uppercase"],
    [".leading", "leading separator"],
    ["trailing.", "trailing separator"],
    ["double..dot", "consecutive separators"],
    ["has space", "whitespace"],
    ["emoji🙏", "non-ascii"],
  ])("rejects %s (%s)", (handle) => {
    expect(validateHandle(handle).valid).toBe(false);
  });

  it("rejects reserved handles, including separator-dodged forms", () => {
    expect(validateHandle("admin").valid).toBe(false);
    expect(validateHandle("ad.min").valid).toBe(false);
    expect(validateHandle("start_here").valid).toBe(false);
  });
});

describe("suggestHandle", () => {
  it("lowercases and separates words", () => {
    expect(suggestHandle("Grace Chapel")).toBe("grace.chapel");
  });
  it("strips diacritics and symbols", () => {
    expect(suggestHandle("José's Ministry!")).toBe("jose.s.ministry");
  });
  it("always returns a valid handle", () => {
    for (const name of ["Grace Chapel", "José!", "A", "--", "The 1517 Project"]) {
      const handle = suggestHandle(name);
      expect(validateHandle(handle).valid, `${name} → ${handle}`).toBe(true);
    }
  });
});
