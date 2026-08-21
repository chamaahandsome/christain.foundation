import { describe, expect, it } from "vitest";
import { validateLinks, validateProfile } from "@/lib/channel-settings";

describe("validateProfile", () => {
  it("accepts a normal profile", () => {
    expect(validateProfile({ name: "Grace Chapel", bio: "Teaching ministry." }).ok).toBe(
      true,
    );
  });

  it("rejects out-of-range names", () => {
    expect(validateProfile({ name: "A", bio: "" }).ok).toBe(false);
    expect(validateProfile({ name: "x".repeat(81), bio: "" }).ok).toBe(false);
    expect(validateProfile({ name: "  ", bio: "" }).ok).toBe(false);
  });

  it("rejects an oversized bio", () => {
    expect(validateProfile({ name: "Grace", bio: "x".repeat(2001) }).ok).toBe(false);
  });
});

describe("validateLinks", () => {
  it("keeps valid https links on known keys", () => {
    const { links, errors } = validateLinks({
      website: "https://gracechapel.org",
      youtube: "https://youtube.com/@grace",
    });
    expect(errors).toEqual([]);
    expect(links.website).toBe("https://gracechapel.org/");
    expect(links.youtube).toBe("https://youtube.com/@grace");
  });

  it("drops unknown keys silently and empty values", () => {
    const { links, errors } = validateLinks({
      myspace: "https://example.com",
      website: "   ",
    });
    expect(errors).toEqual([]);
    expect(links).toEqual({});
  });

  it("rejects non-https and malformed URLs with per-key errors", () => {
    const { links, errors } = validateLinks({
      website: "http://insecure.example",
      instagram: "not a url",
    });
    expect(links).toEqual({});
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatch(/website/);
    expect(errors[1]).toMatch(/instagram/);
  });

  it("rejects absurdly long URLs", () => {
    const { errors } = validateLinks({ website: `https://x.org/${"a".repeat(300)}` });
    expect(errors[0]).toMatch(/too long/);
  });
});
