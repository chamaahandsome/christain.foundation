import { auth, currentUser } from "@clerk/nextjs/server";
import { CommentStatus, Visibility } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { validateCommentBody } from "@/lib/comments";
import { db } from "@/lib/db";

// Comments on watch pages. Post-moderation: live immediately, the
// moderation queue (safety/abuse — distinct from the doctrine audit) acts
// on what's published.

export async function GET(req: Request) {
  const contentItemId = new URL(req.url).searchParams.get("contentItemId");
  if (!contentItemId) {
    return NextResponse.json({ error: "contentItemId is required" }, { status: 400 });
  }

  const comments = await db.comment.findMany({
    where: { contentItemId, status: CommentStatus.APPROVED, parentId: null },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      body: true,
      createdAt: true,
      user: { select: { name: true, imageUrl: true } },
    },
  });

  return NextResponse.json({ comments });
}

const BodySchema = z.object({
  contentItemId: z.string().min(1),
  body: z.string().min(1).max(4000),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const check = validateCommentBody(parsed.data.body);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 422 });
  }

  const item = await db.contentItem.findUnique({
    where: { id: parsed.data.contentItemId },
    select: { id: true, visibility: true, channel: { select: { status: true } } },
  });
  if (!item || item.visibility !== Visibility.PUBLIC || item.channel.status !== "APPROVED") {
    return NextResponse.json({ error: "Content not found." }, { status: 404 });
  }

  const clerkUser = await currentUser();
  await db.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      email:
        clerkUser?.emailAddresses?.[0]?.emailAddress ?? `${userId}@placeholder.invalid`,
      name: clerkUser?.fullName ?? null,
      imageUrl: clerkUser?.imageUrl ?? null,
    },
    update: {},
  });

  const comment = await db.comment.create({
    data: {
      contentItemId: item.id,
      userId,
      body: parsed.data.body.trim(),
      status: CommentStatus.APPROVED,
    },
    select: {
      id: true,
      body: true,
      createdAt: true,
      user: { select: { name: true, imageUrl: true } },
    },
  });

  return NextResponse.json({ comment });
}
