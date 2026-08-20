import { auth } from "@clerk/nextjs/server";
import { NotificationType, ReviewCaseStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { caseTransition, isDecided } from "@/lib/doctrine";
import { doctrineDecisionNotification } from "@/lib/notify";

// The doctrine review queue (concept §5.4). Review is on published teaching;
// outcomes carry notes; upheld decisions can be appealed by the channel.

export async function GET() {
  const { userId } = await auth();
  if (!isAdmin(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [queue, decided] = await Promise.all([
    db.doctrineReviewCase.findMany({
      where: {
        status: {
          in: [ReviewCaseStatus.OPEN, ReviewCaseStatus.IN_REVIEW, ReviewCaseStatus.APPEALED],
        },
      },
      orderBy: { createdAt: "asc" },
      include: {
        channel: { select: { handle: true, name: true } },
        contentItem: { select: { id: true, title: true } },
      },
    }),
    db.doctrineReviewCase.findMany({
      where: { status: { in: [ReviewCaseStatus.UPHELD, ReviewCaseStatus.DISMISSED] } },
      orderBy: { decidedAt: "desc" },
      take: 20,
      include: {
        channel: { select: { handle: true, name: true } },
        contentItem: { select: { id: true, title: true } },
      },
    }),
  ]);

  return NextResponse.json({ queue, decided });
}

const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start_review"), caseId: z.string().min(1) }),
  z.object({
    action: z.literal("uphold"),
    caseId: z.string().min(1),
    note: z.string().min(10).max(5000),
  }),
  z.object({
    action: z.literal("dismiss"),
    caseId: z.string().min(1),
    note: z.string().min(10).max(5000),
  }),
]);

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!isAdmin(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const reviewCase = await db.doctrineReviewCase.findUnique({
    where: { id: body.caseId },
    include: { channel: { select: { name: true, ownerId: true } } },
  });
  if (!reviewCase) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }

  let nextStatus: ReviewCaseStatus;
  try {
    nextStatus = caseTransition(reviewCase.status, body.action);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 409 });
  }

  // Narrow the union: everything except start_review is a decision with a note.
  const decision = body.action === "start_review" ? null : body;
  const updated = await db.doctrineReviewCase.update({
    where: { id: reviewCase.id },
    data: {
      status: nextStatus,
      reviewerId: userId,
      ...(decision
        ? { outcomeNote: decision.note, decidedAt: new Date() }
        : {}),
    },
  });

  // Tell the channel owner about the outcome (§5.5: never arbitrary,
  // always explained).
  if (decision && isDecided(nextStatus)) {
    const planned = doctrineDecisionNotification({
      channelName: reviewCase.channel.name,
      upheld: nextStatus === ReviewCaseStatus.UPHELD,
      outcomeNote: decision.note,
    });
    await db.notification.create({
      data: {
        userId: reviewCase.channel.ownerId,
        type: NotificationType.DOCTRINE_CASE,
        title: planned.title,
        body: planned.body ?? null,
        url: planned.url,
      },
    });
  }

  return NextResponse.json({ case: updated });
}
