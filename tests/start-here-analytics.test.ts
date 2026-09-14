import { describe, expect, it } from "vitest";
import rawData from "@/content/start-here.json";
import type { StartHereData, StartHereTopic, StartHereVideo } from "@/lib/start-here";
import {
  StartHereEventSchema,
  eventProblem,
  itemCatalog,
  playLeaderboard,
  stepFunnel,
  summarize,
} from "@/lib/start-here-analytics";

const real = rawData as StartHereData;
const VISITOR = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";

function video(id: string, order: number, overrides: Partial<StartHereVideo> = {}): StartHereVideo {
  return {
    youtube_id: id,
    title: `Video ${id}`,
    creator: "Creator",
    channel_url: "https://www.youtube.com/@creator",
    duration_seconds: 600,
    why_this_one: "Because.",
    order,
    depth: "milk",
    ...overrides,
  };
}

function topic(slug: string, order: number, overrides: Partial<StartHereTopic> = {}): StartHereTopic {
  return {
    slug,
    label: slug,
    order,
    question: `${slug}?`,
    tier: "essential",
    tier_note: "note",
    framing: "A framing paragraph long enough to pass the minimum-length rule for the value-add.",
    next: null,
    videos: [video(`${slug}-a00000`.slice(0, 11), 1), video(`${slug}-b00000`.slice(0, 11), 2)],
    ...overrides,
  };
}

describe("StartHereEventSchema", () => {
  it("accepts a step view and a play", () => {
    expect(StartHereEventSchema.safeParse({ type: "step_view", visitorId: VISITOR, stepSlug: "who-is-jesus" }).success).toBe(true);
    expect(
      StartHereEventSchema.safeParse({ type: "video_play", visitorId: VISITOR, stepSlug: "who-is-jesus", itemKey: "video:Kud-UrLXjjA" }).success,
    ).toBe(true);
  });

  it("rejects an unknown event type and a malformed visitor id", () => {
    expect(StartHereEventSchema.safeParse({ type: "purchase", visitorId: VISITOR, stepSlug: "x" }).success).toBe(false);
    expect(StartHereEventSchema.safeParse({ type: "step_view", visitorId: "short", stepSlug: "x" }).success).toBe(false);
    expect(StartHereEventSchema.safeParse({ type: "step_view", visitorId: "has spaces and ; chars!!", stepSlug: "x" }).success).toBe(false);
  });
});

describe("eventProblem against the real pathway", () => {
  const play = (stepSlug: string, itemKey?: string) => ({ type: "video_play" as const, visitorId: VISITOR, stepSlug, itemKey });

  it("accepts a view of a real step and plays of a real pick, debate and series", () => {
    expect(eventProblem({ type: "step_view", visitorId: VISITOR, stepSlug: "who-is-jesus" }, real)).toBeNull();
    expect(eventProblem(play("who-is-jesus", "video:Kud-UrLXjjA"), real)).toBeNull();
    expect(eventProblem(play("who-is-jesus", "video:uEnC9FelHL8"), real)).toBeNull();
    expect(eventProblem(play("did-the-resurrection-happen", "series:PL1mr9ZTZb3TUYymBPce08oyuhnHLLkR_B"), real)).toBeNull();
  });

  it("refuses unknown steps, plays without items, items from another step, and views with items", () => {
    expect(eventProblem({ type: "step_view", visitorId: VISITOR, stepSlug: "no-such-step" }, real)).toBe("unknown step");
    expect(eventProblem(play("who-is-jesus"), real)).toBe("a play needs an item");
    expect(eventProblem(play("who-is-jesus", "series:PL1mr9ZTZb3TUYymBPce08oyuhnHLLkR_B"), real)).toBe(
      "that item isn't on this step",
    );
    expect(eventProblem(play("who-is-jesus", "video:REPLACE"), real)).toBe("that item isn't on this step");
    expect(eventProblem({ type: "step_view", visitorId: VISITOR, stepSlug: "who-is-jesus", itemKey: "video:Kud-UrLXjjA" }, real)).toBe(
      "a step view carries no item",
    );
  });
});

describe("itemCatalog", () => {
  it("lists live picks, series and debates in pathway order, skipping empty slots", () => {
    const topics = [
      topic("two", 2),
      topic("one", 1, {
        videos: [video("REPLACE", 1, { title: "REPLACE" }), video("pick1111111", 2)],
        playlists: [
          {
            title: "A series",
            creator: "Series Creator",
            channel_url: "https://www.youtube.com/@s",
            youtube_playlist_id: "PLseries",
            why_this_one: "Because.",
            videos: [],
          },
        ],
        debates: [video("debate11111", 1, { title: "A debate" })],
      }),
    ];
    const catalog = itemCatalog(topics);
    expect(catalog.map((item) => [item.stepSlug, item.kind, item.key])).toEqual([
      ["one", "video", "video:pick1111111"],
      ["one", "series", "series:PLseries"],
      ["one", "debate", "video:debate11111"],
      ["two", "video", "video:two-a00000"],
      ["two", "video", "video:two-b00000"],
    ]);
  });
});

describe("stepFunnel", () => {
  const topics = [topic("s3", 3), topic("s1", 1), topic("s2", 2)];

  it("counts distinct visitors per step, in pathway order, with shares of step 1 and of the step before", () => {
    const rows = [
      { stepSlug: "s1", visitorId: "a" },
      { stepSlug: "s1", visitorId: "a" }, // a repeat view still counts once
      { stepSlug: "s1", visitorId: "b" },
      { stepSlug: "s1", visitorId: "c" },
      { stepSlug: "s1", visitorId: "d" },
      { stepSlug: "s2", visitorId: "a" },
      { stepSlug: "s2", visitorId: "b" },
      { stepSlug: "s3", visitorId: "a" },
    ];
    const funnel = stepFunnel(topics, rows);
    expect(funnel.map((step) => [step.slug, step.visitors])).toEqual([
      ["s1", 4],
      ["s2", 2],
      ["s3", 1],
    ]);
    expect(funnel[1].ofFirst).toBe(0.5);
    expect(funnel[2].fromPrevious).toBe(0.5);
    expect(funnel[0].fromPrevious).toBeNull();
  });

  it("reports no shares when nobody reached step 1", () => {
    const funnel = stepFunnel(topics, [{ stepSlug: "s2", visitorId: "a" }]);
    expect(funnel[1].visitors).toBe(1);
    expect(funnel[1].ofFirst).toBeNull();
    expect(funnel[1].fromPrevious).toBeNull();
  });
});

describe("summarize", () => {
  it("counts visitors, signed-in visitors, completion and plays", () => {
    const topics = [topic("s1", 1), topic("s2", 2)];
    const steps = [
      { stepSlug: "s1", visitorId: "a", userId: null },
      { stepSlug: "s1", visitorId: "b", userId: "user_1" },
      { stepSlug: "s2", visitorId: "b", userId: "user_1" },
      { stepSlug: "s1", visitorId: "c", userId: null },
      { stepSlug: "s1", visitorId: "d", userId: null },
    ];
    const plays = [
      { itemKey: "video:s1-a00000", visitorId: "a" },
      { itemKey: "video:s1-a00000", visitorId: "a" },
      { itemKey: "video:s1-b00000", visitorId: "b" },
    ];
    expect(summarize(topics, steps, plays)).toEqual({
      visitors: 4,
      signedInVisitors: 1,
      reachedFinalStep: 1,
      completionRate: 0.25,
      plays: 3,
      playingVisitors: 2,
    });
  });

  it("has no completion rate before anyone arrives", () => {
    expect(summarize([topic("s1", 1)], [], []).completionRate).toBeNull();
  });
});

describe("playLeaderboard", () => {
  it("ranks by plays with pathway order breaking ties, and keeps unplayed items at zero", () => {
    const topics = [topic("s1", 1), topic("s2", 2)];
    const rows = [
      { itemKey: "video:s2-a00000", visitorId: "a" },
      { itemKey: "video:s2-a00000", visitorId: "a" },
      { itemKey: "video:s2-a00000", visitorId: "b" },
      { itemKey: "video:s1-b00000", visitorId: "c" },
    ];
    const board = playLeaderboard(topics, rows);
    expect(board.map((item) => [item.key, item.plays, item.visitors])).toEqual([
      ["video:s2-a00000", 3, 2],
      ["video:s1-b00000", 1, 1],
      ["video:s1-a00000", 0, 0],
      ["video:s2-b00000", 0, 0],
    ]);
  });
});
