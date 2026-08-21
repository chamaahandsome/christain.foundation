import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";

const CreateSchema = z.object({
  channelId: z.string().min(1),
  title: z.string().min(2).max(200),
  description: z.string().max(4000).optional(),
});

// Create a series — owner, or team staff with library:manager.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const body = parsed.data;

  const access = await getChannelAccess(
    userId,
    body.channelId,
    FEATURES.LIBRARY,
    ACCESS_LEVELS.MANAGER,
  );
  if (!access.channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }
  if (!access.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const series = await db.series.create({
    data: {
      channelId: body.channelId,
      title: body.title.trim(),
      description: body.description?.trim() || null,
    },
  });

  return NextResponse.json({ series });
}

const DeleteSchema = z.object({ seriesId: z.string().min(1) });

// Delete an empty series (items keep playing; a series with items refuses).
export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = DeleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const series = await db.series.findUnique({
    where: { id: parsed.data.seriesId },
    include: { _count: { select: { contentItems: true } } },
  });
  if (!series) {
    return NextResponse.json({ error: "Series not found." }, { status: 404 });
  }

  const access = await getChannelAccess(
    userId,
    series.channelId,
    FEATURES.LIBRARY,
    ACCESS_LEVELS.MANAGER,
  );
  if (!access.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (series._count.contentItems > 0) {
    return NextResponse.json(
      { error: "Move its items out before deleting this series." },
      { status: 409 },
    );
  }

  await db.series.delete({ where: { id: series.id } });
  return NextResponse.json({ removed: true });
}
