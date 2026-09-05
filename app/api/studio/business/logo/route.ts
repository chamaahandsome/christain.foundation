import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getChannelAccess } from "@/lib/team-authorization";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";

// Do-Biz letterhead logo: saved to the channel profile and used as the
// default on new contracts, invoices, and quotes. Keeps up to 3 recents
// for the click-to-use gallery (the Maltivas logoHistory pattern).

const Schema = z.object({
  channelId: z.string().min(1),
  logoUrl: z.string().url().max(2000).nullable(),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { channelId, logoUrl } = parsed.data;
  const access = await getChannelAccess(
    userId,
    channelId,
    FEATURES.BUSINESS,
    ACCESS_LEVELS.MANAGER,
  );
  if (!access.channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  if (!access.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const channel = await db.channel.findUniqueOrThrow({
    where: { id: channelId },
    select: { businessLogoHistory: true },
  });
  const history = Array.isArray(channel.businessLogoHistory)
    ? (channel.businessLogoHistory as string[]).filter((u) => typeof u === "string")
    : [];
  const nextHistory = logoUrl
    ? [logoUrl, ...history.filter((u) => u !== logoUrl)].slice(0, 3)
    : history;

  await db.channel.update({
    where: { id: channelId },
    data: { businessLogoUrl: logoUrl, businessLogoHistory: nextHistory },
  });
  return NextResponse.json({ ok: true, logoUrl, history: nextHistory });
}
