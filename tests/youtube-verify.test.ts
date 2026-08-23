import { describe, expect, it } from "vitest";
import {
  VERIFY_TOKEN_PATTERN,
  descriptionContainsToken,
  generateVerifyToken,
  googleAccountOwnsChannel,
  parseMineChannelIds,
} from "@/lib/youtube-verify";

describe("generateVerifyToken", () => {
  it("produces CF-VERIFY-XXXXXXXX from the unambiguous alphabet", () => {
    for (let i = 0; i < 20; i++) {
      const token = generateVerifyToken();
      expect(token).toMatch(VERIFY_TOKEN_PATTERN);
      // The random suffix avoids lookalike characters ("VERIFY" itself has an I)
      expect(token.slice("CF-VERIFY-".length)).not.toMatch(/[01OIL]/);
    }
  });
});

describe("descriptionContainsToken", () => {
  const token = "CF-VERIFY-ABCD2345";

  it("finds the token anywhere in the description, case-insensitively", () => {
    expect(
      descriptionContainsToken(`Teaching ministry.\n\ncf-verify-abcd2345`, token),
    ).toBe(true);
    expect(
      descriptionContainsToken(`prefix ${token} suffix`, token),
    ).toBe(true);
  });

  it("misses when absent", () => {
    expect(descriptionContainsToken("Teaching ministry.", token)).toBe(false);
    expect(descriptionContainsToken("CF-VERIFY-DIFFERENT", token)).toBe(false);
  });

  it("refuses malformed tokens outright — never match on garbage", () => {
    expect(descriptionContainsToken("anything", "CF-VERIFY-")).toBe(false);
    expect(descriptionContainsToken("x", "")).toBe(false);
  });
});

describe("google ownership check", () => {
  it("parses channels?mine=true ids", () => {
    expect(
      parseMineChannelIds({ items: [{ id: "UCabc" }, { id: "UCdef" }, {}] }),
    ).toEqual(["UCabc", "UCdef"]);
    expect(parseMineChannelIds({})).toEqual([]);
  });

  it("matches only when the linked channel is among the owned ones", () => {
    expect(googleAccountOwnsChannel(["UCabc", "UCdef"], "UCdef")).toBe(true);
    expect(googleAccountOwnsChannel(["UCabc"], "UCdef")).toBe(false);
    expect(googleAccountOwnsChannel([], "UCdef")).toBe(false);
  });
});
