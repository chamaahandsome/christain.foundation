import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

// GET  → latest notifications + unread count
// POST → mark read: { ids: [...] } or { all: true }

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [notifications, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);

  return NextResponse.json({ notifications, unread });
}

const BodySchema = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ ids: z.array(z.string().min(1)).min(1).max(100) }),
]);

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  await db.notification.updateMany({
    where: {
      userId,
      readAt: null,
      ...("ids" in parsed.data ? { id: { in: parsed.data.ids } } : {}),
    },
    data: { readAt: new Date() },
  });

  const unread = await db.notification.count({ where: { userId, readAt: null } });
  return NextResponse.json({ unread });
}
