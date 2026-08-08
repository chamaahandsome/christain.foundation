// Notification planning — pure logic, tested. The rule that matters:
// an initial library import of 200 videos must NOT fan out as 200
// notifications per follower. Small batches notify per item; anything
// larger collapses into one digest.

export interface NotifiableItem {
  id: string;
  title: string;
}

export interface PlannedNotification {
  title: string;
  body?: string;
  url: string;
}

export const DIGEST_THRESHOLD = 3;

export function planContentNotifications(input: {
  channelName: string;
  channelHandle: string;
  items: NotifiableItem[];
  digestThreshold?: number;
}): PlannedNotification[] {
  const threshold = input.digestThreshold ?? DIGEST_THRESHOLD;
  const { items } = input;

  if (items.length === 0) return [];

  if (items.length <= threshold) {
    return items.map((item) => ({
      title: `${input.channelName}: ${item.title}`,
      url: `/watch/${item.id}`,
    }));
  }

  return [
    {
      title: `${input.channelName} added ${items.length} new items`,
      body: items
        .slice(0, 5)
        .map((item) => item.title)
        .join(" · "),
      url: `/@${input.channelHandle}`,
    },
  ];
}

export function applicationDecisionNotification(input: {
  approved: boolean;
  channelHandle?: string;
  decisionNote?: string | null;
}): PlannedNotification {
  if (input.approved) {
    return {
      title: "Your creator application was approved — welcome.",
      body: "Your channel is live. Head to the studio to import your library.",
      url: "/studio",
    };
  }
  return {
    title: "Your creator application was not approved.",
    body:
      input.decisionNote ??
      "See the decision note on your application. You may revise and reapply.",
    url: "/studio",
  };
}
