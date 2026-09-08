import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const BodySchema = z.object({
  contentItemId: z.string().min(1),
  positionSec: z.number().int().min(0),
  completed: z.boolean().optional(),
});

// Resume position for the player (watch pages are CDN-cached, so the client
// asks for continue-watching itself). Returns { positionSec } only when there
// is a meaningful, unfinished position; null otherwise.
export async function GET(req: Request) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return NextResponse.json(null);
  }
  const { userId } = await auth();
  if (!userId) return NextResponse.json(null);

  const contentItemId = new URL(req.url).searchParams.get("contentItemId");
  if (!contentItemId) {
    return NextResponse.json({ error: "contentItemId required" }, { status: 400 });
  }

  const progress = await db.watchProgress.findUnique({
    where: { userId_contentItemId: { userId, contentItemId } },
    select: { positionSec: true, completedAt: true },
  });
  if (!progress || progress.completedAt || progress.positionSec <= 10) {
    return NextResponse.json(null);
  }
  return NextResponse.json({ positionSec: progress.positionSec });
}

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
