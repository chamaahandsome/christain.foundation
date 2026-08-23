import { CommentStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminUser } from "@/lib/admin";
import { db } from "@/lib/db";

// Safety/abuse moderation on published comments — distinct queue from the
// doctrine audit (§5.4), shared infrastructure.

export async function GET() {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const comments = await db.comment.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      body: true,
      status: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
      contentItem: { select: { id: true, title: true } },
    },
  });

  return NextResponse.json({ comments });
}

const BodySchema = z.object({
  commentId: z.string().min(1),
  status: z.enum([CommentStatus.APPROVED, CommentStatus.HIDDEN, CommentStatus.REMOVED]),
});

export async function PATCH(req: Request) {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const existing = await db.comment.findUnique({
    where: { id: parsed.data.commentId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Comment not found." }, { status: 404 });
  }

  const comment = await db.comment.update({
    where: { id: existing.id },
    data: { status: parsed.data.status },
  });

  return NextResponse.json({ comment });
}
