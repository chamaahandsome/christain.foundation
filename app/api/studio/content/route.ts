import { auth } from "@clerk/nextjs/server";
import { Visibility } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";

const BodySchema = z.object({
  contentItemId: z.string().min(1),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(10000).nullable().optional(),
  visibility: z.nativeEnum(Visibility).optional(),
  // null clears the series; undefined leaves it untouched
  seriesId: z.string().min(1).nullable().optional(),
});

// Edit a library item — owner, or team staff with library:manager.
export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const body = parsed.data;

  const item = await db.contentItem.findUnique({
    where: { id: body.contentItemId },
    select: { id: true, channelId: true },
  });
  if (!item) {
    return NextResponse.json({ error: "Content not found." }, { status: 404 });
  }

  const access = await getChannelAccess(
    userId,
    item.channelId,
    FEATURES.LIBRARY,
    ACCESS_LEVELS.MANAGER,
  );
  if (!access.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // A series must belong to the same channel — no cross-channel grafting.
  if (body.seriesId) {
    const series = await db.series.findUnique({
      where: { id: body.seriesId },
      select: { channelId: true },
    });
    if (!series || series.channelId !== item.channelId) {
      return NextResponse.json({ error: "Series not found on this channel." }, { status: 404 });
    }
  }

  const updated = await db.contentItem.update({
    where: { id: item.id },
    data: {
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.description !== undefined
        ? { description: body.description?.trim() || null }
        : {}),
      ...(body.visibility !== undefined ? { visibility: body.visibility } : {}),
      ...(body.seriesId !== undefined ? { seriesId: body.seriesId } : {}),
    },
  });

  return NextResponse.json({ item: updated });
}
