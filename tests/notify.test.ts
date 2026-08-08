import { describe, expect, it } from "vitest";
import {
  applicationDecisionNotification,
  DIGEST_THRESHOLD,
  planContentNotifications,
} from "@/lib/notify";

const channel = { channelName: "Grace Chapel", channelHandle: "grace.chapel" };

describe("planContentNotifications", () => {
  it("returns nothing for no items", () => {
    expect(planContentNotifications({ ...channel, items: [] })).toEqual([]);
  });

  it("notifies per item at or below the digest threshold", () => {
    const items = [
      { id: "a", title: "Romans 8 — part 1" },
      { id: "b", title: "Romans 8 — part 2" },
    ];
    const planned = planContentNotifications({ ...channel, items });
    expect(planned).toHaveLength(2);
    expect(planned[0]).toEqual({
      title: "Grace Chapel: Romans 8 — part 1",
      url: "/watch/a",
    });
  });

  it("collapses a bulk import into a single digest — no notification storms", () => {
    const items = Array.from({ length: 200 }, (_, i) => ({
      id: `id${i}`,
      title: `Video ${i}`,
    }));
    const planned = planContentNotifications({ ...channel, items });
    expect(planned).toHaveLength(1);
    expect(planned[0].title).toBe("Grace Chapel added 200 new items");
    expect(planned[0].url).toBe("/@grace.chapel");
    // digest body previews at most 5 titles
    expect(planned[0].body!.split(" · ")).toHaveLength(5);
  });

  it("boundary: exactly the threshold notifies per item, threshold+1 digests", () => {
    const make = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `${i}`, title: `t${i}` }));
    expect(
      planContentNotifications({ ...channel, items: make(DIGEST_THRESHOLD) }),
    ).toHaveLength(DIGEST_THRESHOLD);
    expect(
      planContentNotifications({ ...channel, items: make(DIGEST_THRESHOLD + 1) }),
    ).toHaveLength(1);
  });
});

describe("applicationDecisionNotification", () => {
  it("welcomes on approval and points at the studio", () => {
    const n = applicationDecisionNotification({ approved: true });
    expect(n.title).toMatch(/approved/);
    expect(n.url).toBe("/studio");
  });

  it("carries the decision note on rejection", () => {
    const n = applicationDecisionNotification({
      approved: false,
      decisionNote: "The ministry statement conflicts with clause 3.",
    });
    expect(n.body).toBe("The ministry statement conflicts with clause 3.");
  });

  it("falls back to a revise-and-reapply message without a note", () => {
    const n = applicationDecisionNotification({ approved: false });
    expect(n.body).toMatch(/revise and reapply/);
  });
});
