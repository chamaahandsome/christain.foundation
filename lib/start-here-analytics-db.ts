// Start Here analytics — the database side, server only. The rules and the
// arithmetic live in lib/start-here-analytics; this file only writes events
// and reads rows for the admin dashboard.

import { StartHereEventType as EventType } from "@prisma/client";
import { db } from "@/lib/db";
import { startHereTopics } from "@/lib/start-here";
import {
  playLeaderboard,
  stepFunnel,
  summarize,
  type StartHereEvent,
} from "@/lib/start-here-analytics";

/** The windows the dashboard offers, in days. */
export const ANALYTICS_WINDOWS = [7, 30, 90] as const;

export async function recordStartHereEvent(
  event: StartHereEvent & { userId: string | null },
): Promise<void> {
  await db.startHereEvent.create({
    data: {
      type: event.type === "video_play" ? EventType.VIDEO_PLAY : EventType.STEP_VIEW,
      visitorId: event.visitorId,
      userId: event.userId,
      stepSlug: event.stepSlug,
      itemKey: event.itemKey ?? null,
    },
  });
}

/**
 * The dashboard for the last `days` days. Reads raw rows, which is fine at
 * launch volumes; if this grows, roll events up by day and read the rollup.
 */
export async function loadStartHereAnalytics(days: number) {
  const since = new Date(Date.now() - days * 86_400_000);
  const topics = startHereTopics();
  const [stepRows, playRows] = await Promise.all([
    db.startHereEvent.findMany({
      where: { type: EventType.STEP_VIEW, createdAt: { gte: since } },
      select: { stepSlug: true, visitorId: true, userId: true },
    }),
    db.startHereEvent.findMany({
      where: { type: EventType.VIDEO_PLAY, createdAt: { gte: since }, itemKey: { not: null } },
      select: { itemKey: true, visitorId: true },
    }),
  ]);
  const plays = playRows.map((row) => ({ itemKey: row.itemKey as string, visitorId: row.visitorId }));
  return {
    days,
    since,
    summary: summarize(topics, stepRows, plays),
    funnel: stepFunnel(topics, stepRows),
    items: playLeaderboard(topics, plays),
  };
}
