import { describe, expect, it } from "vitest";
import rawData from "@/content/start-here.json";
import {
  formatDuration,
  formatDurationCoarse,
  hasPlaceholders,
  validateStartHere,
  type StartHereData,
  type StartHereTopic,
  type StartHereVideo,
} from "@/lib/start-here";

function video(overrides: Partial<StartHereVideo> = {}): StartHereVideo {
  return {
    youtube_id: "dQw4w9WgXcQ",
    title: "A real title",
    creator: "Creator A",
    channel_url: "https://www.youtube.com/@creatora",
    duration_seconds: 600,
    why_this_one: "The clearest walk-through of the question.",
    order: 1,
    ...overrides,
  };
}

function topic(overrides: Partial<StartHereTopic> = {}): StartHereTopic {
  return {
    slug: "t1",
    label: "Short label",
    order: 1,
    question: "A question?",
    tier: "essential",
    tier_note: "note",
    framing:
      "A framing paragraph long enough to pass the minimum-length rule for the value-add.",
    next: null,
    videos: [
      video({ order: 1 }),
      video({ order: 2, creator: "Creator B" }),
      video({ order: 3, creator: "Creator C" }),
    ],
    ...overrides,
  };
}

function chain(...topics: StartHereTopic[]): StartHereData {
  return { topics };
}

describe("validateStartHere — structural rules", () => {
  it("passes a well-formed two-topic chain", () => {
    const data = chain(
      topic({ slug: "a", order: 1, next: "b" }),
      topic({ slug: "b", order: 2, next: null }),
    );
    expect(validateStartHere(data)).toEqual([]);
  });

  it("fails duplicate video order within a topic", () => {
    const data = chain(
      topic({ videos: [video({ order: 1 }), video({ order: 1 }), video({ order: 2 })] }),
    );
    expect(validateStartHere(data).join(" ")).toMatch(/duplicate video order/);
  });

  it("fails next pointing at a missing slug", () => {
    const data = chain(topic({ next: "ghost" }));
    expect(validateStartHere(data).join(" ")).toMatch(/missing slug/);
  });

  it("fails a broken chain (next must follow order)", () => {
    const data = chain(
      topic({ slug: "a", order: 1, next: null }), // should point at b
      topic({ slug: "b", order: 2, next: null }),
    );
    expect(validateStartHere(data).join(" ")).toMatch(/a: next should be "b"/);
  });

  it("fails a topic with fewer than 3 videos", () => {
    const data = chain(topic({ videos: [video()] }));
    expect(validateStartHere(data).join(" ")).toMatch(/must be 3–6/);
  });

  it("fails duplicate topic orders and slugs", () => {
    const data = chain(
      topic({ slug: "a", order: 1, next: "a" }),
      topic({ slug: "a", order: 1, next: null }),
    );
    const joined = validateStartHere(data).join(" ");
    expect(joined).toMatch(/Duplicate topic slug/);
    expect(joined).toMatch(/Duplicate topic order/);
  });
});

describe("validateStartHere — strict content rules", () => {
  it("fails any remaining REPLACE", () => {
    const data = chain(
      topic({ videos: [video({ title: "REPLACE" }), video({ order: 2 }), video({ order: 3 })] }),
    );
    expect(validateStartHere(data, { strict: true }).join(" ")).toMatch(/REPLACE/);
    expect(validateStartHere(data)).toEqual([]); // non-strict tolerates placeholders
  });

  it("fails invalid youtube ids and zero durations", () => {
    const data = chain(
      topic({
        videos: [
          video({ youtube_id: "short" }),
          video({ order: 2, duration_seconds: 0 }),
          video({ order: 3 }),
        ],
      }),
    );
    const joined = validateStartHere(data, { strict: true }).join(" ");
    expect(joined).toMatch(/invalid youtube_id/);
    expect(joined).toMatch(/no duration/);
  });

  it("fails a creator appearing more than 4 times across the pathway", () => {
    const many = (slug: string, order: number, next: string | null) =>
      topic({
        slug,
        order,
        next,
        videos: [
          video({ order: 1, creator: "Prolific" }),
          video({ order: 2, creator: "Prolific" }),
          video({ order: 3, creator: `Other-${slug}` }),
        ],
      });
    const data = chain(many("a", 1, "b"), many("b", 2, "c"), many("c", 3, null));
    expect(validateStartHere(data, { strict: true }).join(" ")).toMatch(
      /Prolific appears 6 times/,
    );
  });

  it("fails an open_question topic with a single creator", () => {
    const data = chain(
      topic({
        tier: "open_question",
        videos: [
          video({ order: 1, creator: "Only One" }),
          video({ order: 2, creator: "Only One" }),
          video({ order: 3, creator: "Only One" }),
        ],
      }),
    );
    expect(validateStartHere(data, { strict: true }).join(" ")).toMatch(
      /at least two views/,
    );
  });
});

describe("the real content file", () => {
  const data = rawData as StartHereData;

  it("is structurally valid", () => {
    expect(validateStartHere(data)).toEqual([]);
  });

  it("has the 16 topics in the specified order", () => {
    const slugs = [...data.topics].sort((a, b) => a.order - b.order).map((t) => t.slug);
    expect(slugs).toEqual([
      "who-is-jesus",
      "what-just-happened",
      "did-the-resurrection-happen",
      "who-is-god",
      "can-i-trust-the-bible",
      "how-do-i-read-the-bible",
      "how-do-i-pray",
      "am-i-really-saved",
      "why-do-i-still-sin",
      "do-i-need-a-church",
      "why-is-there-suffering",
      "only-one-way",
      "what-will-my-family-say",
      "what-is-baptism",
      "what-christians-disagree-about",
      "does-science-disprove-god",
    ]);
  });

  it("closes with the three open questions, science last", () => {
    const byOrder = [...data.topics].sort((a, b) => a.order - b.order);
    expect(byOrder.slice(13).map((t) => t.slug)).toEqual([
      "what-is-baptism",
      "what-christians-disagree-about",
      "does-science-disprove-god",
    ]);
    expect(byOrder.slice(13).every((t) => t.tier === "open_question")).toBe(true);
    expect(byOrder[15].next).toBeNull();
    expect(byOrder.slice(0, 13).every((t) => t.tier === "essential")).toBe(true);
  });

  it("strict mode fails while placeholders remain (the pre-launch gate)", () => {
    if (hasPlaceholders(data)) {
      expect(validateStartHere(data, { strict: true }).length).toBeGreaterThan(0);
    } else {
      // once curation lands, the real file must pass strict in full
      expect(validateStartHere(data, { strict: true })).toEqual([]);
    }
  });
});

describe("real content pills", () => {
  it("every topic has a short label for the progress pills", () => {
    for (const t of (rawData as StartHereData).topics) {
      expect(t.label.length, t.slug).toBeGreaterThan(0);
      expect(t.label.length, t.slug).toBeLessThanOrEqual(24);
    }
  });
});

describe("formatDurationCoarse", () => {
  it.each([
    [0, ""],
    [45, "1 min"],
    [840, "14 min"],
    [2520, "42 min"],
    [3600, "1 h"],
    [3900, "1 h 5 min"],
  ])("%d seconds → %s", (input, expected) => {
    expect(formatDurationCoarse(input)).toBe(expected);
  });
});

describe("formatDuration", () => {
  it.each([
    [0, ""],
    [59, "0:59"],
    [61, "1:01"],
    [600, "10:00"],
    [3661, "1:01:01"],
  ])("%d seconds → %s", (input, expected) => {
    expect(formatDuration(input)).toBe(expected);
  });
});
