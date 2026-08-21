import { auth } from "@clerk/nextjs/server";
import { NotificationType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ingestChannel } from "@/lib/ingest";
import { planContentNotifications } from "@/lib/notify";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";

const BodySchema = z.object({
  channelId: z.string().min(1),
});

// Imports a channel's YouTube library into the embedded catalog.
// Auth is enforced by middleware (/api/studio/*) and re-checked here.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "YOUTUBE_API_KEY is not configured." },
      { status: 503 },
    );
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Owner, or a team member with manager access to the library (PLAN §4:
  // ministry staff run the channel).
  const access = await getChannelAccess(
    userId,
    parsed.data.channelId,
    FEATURES.LIBRARY,
    ACCESS_LEVELS.MANAGER,
  );
  const { channel } = access;
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }
  if (!access.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!channel.youtubeChannelId) {
    return NextResponse.json(
      { error: "Channel has no linked YouTube channel." },
      { status: 400 },
    );
  }

  try {
    // Bounded per request: 4 pages × 50 = 200 newest videos. Full-library
    // backfill moves to a queue when volumes demand it.
    const result = await ingestChannel(channel.id, { apiKey, maxPages: 4 });

    // Fan out to followers — per-item for small drops, one digest for bulk
    // imports (lib/notify rules, tested).
    if (result.created > 0) {
      const channelInfo = await db.channel.findUniqueOrThrow({
        where: { id: channel.id },
        select: {
          name: true,
          handle: true,
          followers: { select: { userId: true } },
        },
      });
      if (channelInfo.followers.length > 0) {
        const planned = planContentNotifications({
          channelName: channelInfo.name,
          channelHandle: channelInfo.handle,
          items: result.createdItems,
        });
        await db.notification.createMany({
          data: channelInfo.followers.flatMap((follower) =>
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

    const { createdItems: _, ...summary } = result;
    return NextResponse.json(summary);
  } catch (err) {
    console.error("ingest failed", err);
    // Resolution problems are the user's to fix (wrong handle/URL in
    // settings) — surface them; anything else stays a generic upstream error.
    const message = err instanceof Error ? err.message : "";
    if (message.includes("Could not find that YouTube channel")) {
      return NextResponse.json({ error: message }, { status: 422 });
    }
    return NextResponse.json({ error: "Ingestion failed" }, { status: 502 });
  }
}
