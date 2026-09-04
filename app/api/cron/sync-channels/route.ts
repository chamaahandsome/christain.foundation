import { NextResponse } from "next/server";
import { NotificationType } from "@prisma/client";
import { db } from "@/lib/db";
import { ingestChannel } from "@/lib/ingest";
import { planContentNotifications } from "@/lib/notify";

// Library freshness: creators' new YouTube uploads used to arrive only when
// someone pressed Import in the studio. This cron re-ingests the newest
// uploads (one API page ≈ 50 videos) for every approved, verified channel,
// so a video published today is in the library tomorrow. ingestChannel
// upserts — reruns are safe, and revived videos clear their unavailable flag.

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "YOUTUBE_API_KEY not configured" }, { status: 503 });
  }

  // Sync any approved channel whose library was already imported — the
  // import gate (ownership verification, or an admin) was passed then;
  // keeping that same library fresh claims nothing new.
  const channels = await db.channel.findMany({
    where: {
      status: "APPROVED",
      youtubeChannelId: { not: null },
      contentItems: { some: { youtubeVideoId: { not: null } } },
    },
    select: { id: true, name: true, handle: true },
  });

  const results: { handle: string; created: number; error?: string }[] = [];
  for (const channel of channels) {
    try {
      const result = await ingestChannel(channel.id, { apiKey, maxPages: 1 });
      results.push({ handle: channel.handle, created: result.created });

      if (result.created > 0) {
        const followers = await db.follow.findMany({
          where: { channelId: channel.id },
          select: { userId: true },
        });
        if (followers.length > 0) {
          const planned = planContentNotifications({
            channelName: channel.name,
            channelHandle: channel.handle,
            items: result.createdItems,
          });
          await db.notification.createMany({
            data: followers.flatMap((follower) =>
              planned.map((n) => ({
                userId: follower.userId,
                type: NotificationType.NEW_CONTENT,
                title: n.title,
                body: n.body ?? null,
                url: n.url,
              })),
            ),
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ handle: channel.handle, created: 0, error: msg.slice(0, 200) });
      console.error(`sync-channels: ${channel.handle} failed — ${msg}`);
    }
  }

  const created = results.reduce((sum, r) => sum + r.created, 0);
  if (created > 0) console.log(`sync-channels: ${created} new items`, results);
  return NextResponse.json({ channels: results.length, created, results });
}
