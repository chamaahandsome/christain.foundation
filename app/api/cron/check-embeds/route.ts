import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Dead-embed detection (PLAN §9 open question 4): a creator deleting or
// privating a YouTube video must not leave broken embeds in the library.
// Deleted/private videos stop serving hqdefault.jpg — same liveness signal
// scripts/check-start-here.ts uses. Marked items vanish from public
// surfaces (unavailableAt filter) but stay in the studio; recovered videos
// are restored on a later pass or by re-import.

const BATCH = 120; // per run — the cron sweeps the library over days

async function isAlive(videoId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, {
      method: "HEAD",
    });
    return res.ok;
  } catch {
    return true; // network hiccup — never mark dead on a flake
  }
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Least-recently-touched live items first; also recheck a slice of the
  // marked-dead ones in case they came back.
  const [candidates, deadOnes] = await Promise.all([
    db.contentItem.findMany({
      where: { youtubeVideoId: { not: null }, unavailableAt: null },
      orderBy: { updatedAt: "asc" },
      take: BATCH,
      select: { id: true, youtubeVideoId: true },
    }),
    db.contentItem.findMany({
      where: { youtubeVideoId: { not: null }, unavailableAt: { not: null } },
      orderBy: { updatedAt: "asc" },
      take: 30,
      select: { id: true, youtubeVideoId: true },
    }),
  ]);

  let markedDead = 0;
  let recovered = 0;

  for (const item of candidates) {
    if (!(await isAlive(item.youtubeVideoId!))) {
      await db.contentItem.update({
        where: { id: item.id },
        data: { unavailableAt: new Date() },
      });
      markedDead += 1;
    } else {
      // Touch updatedAt so the sweep rotates through the library.
      await db.contentItem.update({ where: { id: item.id }, data: {} });
    }
  }
  for (const item of deadOnes) {
    if (await isAlive(item.youtubeVideoId!)) {
      await db.contentItem.update({
        where: { id: item.id },
        data: { unavailableAt: null },
      });
      recovered += 1;
    } else {
      await db.contentItem.update({ where: { id: item.id }, data: {} });
    }
  }

  return NextResponse.json({
    checked: candidates.length,
    rechecked: deadOnes.length,
    markedDead,
    recovered,
  });
}
