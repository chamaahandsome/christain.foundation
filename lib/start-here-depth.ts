// Admin overrides for Start Here's milk/meat labels — server only.
//
// content/start-here.json carries each item's first label and ships with
// the build, so a live relabel can't write there. It lands in the
// StartHereDepthOverride table instead, and the pages lay it over the
// file's label (applyDepthOverrides in lib/start-here).

import { StartHereDepthLevel } from "@prisma/client";
import { db } from "@/lib/db";
import type { StartHereDepth } from "@/lib/start-here";

const toLevel = (depth: StartHereDepth): StartHereDepthLevel =>
  depth === "meat" ? StartHereDepthLevel.MEAT : StartHereDepthLevel.MILK;

const fromLevel = (level: StartHereDepthLevel): StartHereDepth =>
  level === StartHereDepthLevel.MEAT ? "meat" : "milk";

/** Every admin override, keyed as lib/start-here builds keys. */
export async function loadDepthOverrides(): Promise<Record<string, StartHereDepth>> {
  try {
    const rows = await db.startHereDepthOverride.findMany({
      select: { key: true, depth: true },
    });
    return Object.fromEntries(rows.map((row) => [row.key, fromLevel(row.depth)]));
  } catch (err) {
    // A deploy that lands ahead of `prisma db push`, or a database blip,
    // must not take Start Here down — the file's labels still stand.
    console.error("start-here: depth overrides unavailable, using file labels", err);
    return {};
  }
}

/** Record an admin's switch for one item. */
export async function saveDepthOverride(input: {
  key: string;
  depth: StartHereDepth;
  userId: string;
}): Promise<void> {
  await db.startHereDepthOverride.upsert({
    where: { key: input.key },
    create: { key: input.key, depth: toLevel(input.depth), updatedById: input.userId },
    update: { depth: toLevel(input.depth), updatedById: input.userId },
  });
}
