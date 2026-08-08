import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const BodySchema = z.object({
  contentItemId: z.string().min(1),
  positionSec: z.number().int().min(0),
  completed: z.boolean().optional(),
});

// Continue-watching progress from the player. Signed-out viewers are fine —
// we just don't record anything (204 either way; the player fires and forgets).
export async function POST(req: Request) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return new NextResponse(null, { status: 204 });
  }

  const { userId } = await auth();
  if (!userId) {
    return new NextResponse(null, { status: 204 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { contentItemId, positionSec, completed } = parsed.data;

  const exists = await db.contentItem.findUnique({
    where: { id: contentItemId },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Unknown content item" }, { status: 404 });
  }

  await db.watchProgress.upsert({
    where: { userId_contentItemId: { userId, contentItemId } },
    create: {
      userId,
      contentItemId,
      positionSec,
      completedAt: completed ? new Date() : null,
    },
    update: {
      positionSec,
      ...(completed ? { completedAt: new Date() } : {}),
    },
  });

  return new NextResponse(null, { status: 204 });
}
