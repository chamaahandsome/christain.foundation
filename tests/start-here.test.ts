import { describe, expect, it } from "vitest";
import rawData from "@/content/start-here.json";
import {
  formatDuration,
  formatDurationCoarse,
  hasPlaceholders,
  nextPlaylistIndex,
  playlistDuration,
  validateStartHere,
  type StartHereData,
  type StartHerePlaylist,
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

function playlist(overrides: Partial<StartHerePlaylist> = {}): StartHerePlaylist {
  return {
    title: "A series",
    creator: "Series Creator",
    channel_url: "https://www.youtube.com/@series",
    youtube_playlist_id: "PL1mr9ZTZb3TUYymBPce08oyuhnHLLkR_B",
    why_this_one: "Walks the question in order, one part at a time.",
    videos: [
      { youtube_id: "aaaaaaaaaaa", title: "Part 1", duration_seconds: 300 },
      { youtube_id: "bbbbbbbbbbb", title: "Part 2", duration_seconds: 600 },
      { youtube_id: "ccccccccccc", title: "Part 3", duration_seconds: 900 },
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

describe("step 3's series", () => {
  it("is InspiringPhilosophy's resurrection series, parts 1–6 in order", () => {
    const step3 = (rawData as StartHereData).topics.find(
      (t) => t.slug === "did-the-resurrection-happen",
    );
    expect(step3?.playlists?.[0]?.creator).toBe("InspiringPhilosophy");
    expect(step3?.playlists?.[0]?.videos.map((v) => v.youtube_id)).toEqual([
      "-ErnJF_nwBk",
      "A0iDNLxmWVM",
      "HdIM8QoD8UE",
      "UWbShiINl4s",
      "9VEQWQHYy7s",
      "rffmrioFnBY",
    ]);
  });
});

describe("step 4's series", () => {
  it("is Allen Nolan's attributes of God study, five parts, above the picks", () => {
    const step4 = (rawData as StartHereData).topics.find((t) => t.slug === "who-is-god");
    expect(step4?.playlists?.[0]?.creator).toBe("Allen Nolan");
    expect(step4?.playlists?.[0]?.position).toBe("first");
    expect(step4?.playlists?.[0]?.videos.map((v) => v.youtube_id)).toEqual([
      "WnYB8zypYxA",
      "HtB-rg8CWTc",
      "EauMrZOcMbE",
      "p1jXUGqFLAI",
      "pTijCOee9Zs",
    ]);
  });
});

describe("step 5's series", () => {
  it("is Mike Winger's Evidence for the Bible, all twenty parts in order", () => {
    const step5 = (rawData as StartHereData).topics.find((t) => t.slug === "can-i-trust-the-bible");
    const ids = step5?.playlists?.[0]?.videos.map((v) => v.youtube_id) ?? [];
    expect(step5?.playlists?.[0]?.creator).toBe("Mike Winger");
    expect(ids).toHaveLength(20);
    expect(ids[0]).toBe("EjnwldgqN8c");
    expect(ids[19]).toBe("7zS4VgFDf8s");
    expect(new Set(ids).size).toBe(20);
  });
});

describe("step 5 carries two series", () => {
  it("Mike Winger's Evidence for the Bible, then Wes Huff's Can I Trust the Bible", () => {
    const step5 = (rawData as StartHereData).topics.find((t) => t.slug === "can-i-trust-the-bible");
    expect(step5?.playlists?.map((s) => s.creator)).toEqual(["Mike Winger", "Wes Huff"]);
    expect(step5?.playlists?.[1]?.videos).toHaveLength(10);
    expect(step5?.playlists?.[1]?.videos[0]?.youtube_id).toBe("nMufJZeRdCI");
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

describe("validateStartHere — playlists", () => {
  it("passes a topic with a well-formed series", () => {
    expect(validateStartHere(chain(topic({ playlists: [playlist()] })), { strict: true })).toEqual([]);
  });

  it("accepts a series placed first or last, and nothing else", () => {
    for (const position of ["first", "last"] as const) {
      expect(validateStartHere(chain(topic({ playlists: [playlist({ position })] })))).toEqual([]);
    }
    const odd = playlist({ position: "middle" as unknown as "first" });
    expect(validateStartHere(chain(topic({ playlists: [odd] }))).join(" ")).toMatch(
      /position must be "first" or "last"/,
    );
  });

  it("does not count a series against the 3–6 video limit", () => {
    const sixParts = playlist({
      videos: "abcdef".split("").map((c, i) => ({
        youtube_id: c.repeat(11),
        title: `Part ${i + 1}`,
        duration_seconds: 300,
      })),
    });
    expect(validateStartHere(chain(topic({ playlists: [sixParts] })))).toEqual([]);
  });

  it("allows a long series up to 24 parts and refuses a 25th", () => {
    const parts = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        youtube_id: `part-${String(i).padStart(6, "0")}`,
        title: `Part ${i + 1}`,
        duration_seconds: 600,
      }));
    expect(validateStartHere(chain(topic({ playlists: [playlist({ videos: parts(24) })] })))).toEqual([]);
    expect(
      validateStartHere(chain(topic({ playlists: [playlist({ videos: parts(25) })] }))).join(" "),
    ).toMatch(/playlist has 25 videos \(must be 2–24\)/);
  });

  it("holds several series in one topic, and refuses the same playlist twice", () => {
    const second = playlist({
      title: "Another series",
      youtube_playlist_id: "PLNOXJdb0gACFBB43j4YwG9fYGE-YtRzhG",
      videos: [
        { youtube_id: "ddddddddddd", title: "Part 1", duration_seconds: 300 },
        { youtube_id: "eeeeeeeeeee", title: "Part 2", duration_seconds: 300 },
      ],
    });
    expect(
      validateStartHere(chain(topic({ playlists: [playlist(), second] })), { strict: true }),
    ).toEqual([]);
    expect(
      validateStartHere(chain(topic({ playlists: [playlist(), playlist()] }))).join(" "),
    ).toMatch(/is listed twice/);
  });

  it("counts each series in a topic toward its creator's share", () => {
    const picks = [
      video({ order: 1, creator: "Creator A" }),
      video({ order: 2, creator: "Creator A" }),
      video({ order: 3, creator: "Creator B" }),
    ];
    const two = [
      playlist({ creator: "Creator A" }),
      playlist({ creator: "Creator A", youtube_playlist_id: "PLNOXJdb0gACFBB43j4YwG9fYGE-YtRzhG" }),
    ];
    // 2 picks + 2 series = 4, the limit; a third series tips it over.
    expect(
      validateStartHere(chain(topic({ videos: picks, playlists: two })), { strict: true }).join(" "),
    ).not.toMatch(/appears/);
    const three = [
      ...two,
      playlist({ creator: "Creator A", youtube_playlist_id: "PLZ3iRMLYFlHuhA0RPKZFHVcjIMN_-F596" }),
    ];
    expect(
      validateStartHere(chain(topic({ videos: picks, playlists: three })), { strict: true }).join(" "),
    ).toMatch(/Creator A appears 5 times/);
  });

  it("fails a one-part series and a repeated part", () => {
    const one = playlist({ videos: [{ youtube_id: "aaaaaaaaaaa", title: "Only", duration_seconds: 60 }] });
    expect(validateStartHere(chain(topic({ playlists: [one] }))).join(" ")).toMatch(/playlist has 1 videos/);

    const repeated = playlist({
      videos: [
        { youtube_id: "aaaaaaaaaaa", title: "Part 1", duration_seconds: 60 },
        { youtube_id: "aaaaaaaaaaa", title: "Part 1 again", duration_seconds: 60 },
      ],
    });
    expect(validateStartHere(chain(topic({ playlists: [repeated] }))).join(" ")).toMatch(/repeats video/);
  });

  it("strict mode holds the parts to the same standard as the picks", () => {
    const bad = playlist({
      channel_url: "https://example.com/series",
      videos: [
        { youtube_id: "short", title: "Part 1", duration_seconds: 300 },
        { youtube_id: "bbbbbbbbbbb", title: "Part 2", duration_seconds: 0 },
      ],
    });
    const data = chain(topic({ playlists: [bad] }));
    expect(validateStartHere(data)).toEqual([]); // structurally fine
    const joined = validateStartHere(data, { strict: true }).join(" ");
    expect(joined).toMatch(/part 1 has invalid youtube_id/);
    expect(joined).toMatch(/part 2 has no duration/);
    expect(joined).toMatch(/playlist channel_url/);
  });

  it("counts a series once toward its creator's share, not once per part", () => {
    const threePicks = [
      video({ order: 1, creator: "Creator A" }),
      video({ order: 2, creator: "Creator A" }),
      video({ order: 3, creator: "Creator A" }),
    ];
    // 3 picks + one 3-part series = 4, the limit exactly.
    const atLimit = chain(topic({ videos: threePicks, playlists: [playlist({ creator: "Creator A" })] }));
    expect(validateStartHere(atLimit, { strict: true }).join(" ")).not.toMatch(/appears/);

    // A fourth pick tips it over.
    const over = chain(
      topic({
        videos: [...threePicks, video({ order: 4, creator: "Creator A" })],
        playlists: [playlist({ creator: "Creator A" })],
      }),
    );
    expect(validateStartHere(over, { strict: true }).join(" ")).toMatch(/Creator A appears 5 times/);
  });
});

describe("playlist helpers", () => {
  it("steps to the next part and stops after the last", () => {
    expect(nextPlaylistIndex(0, 6)).toBe(1);
    expect(nextPlaylistIndex(4, 6)).toBe(5);
    expect(nextPlaylistIndex(5, 6)).toBeNull();
    expect(nextPlaylistIndex(0, 1)).toBeNull();
  });

  it("totals a series' running time", () => {
    expect(playlistDuration(playlist())).toBe(1800);
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
