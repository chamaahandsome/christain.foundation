import { auth } from "@clerk/nextjs/server";
import { ApplicationStatus, NotificationType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { applicationTransition } from "@/lib/gate";
import { validateHandle } from "@/lib/handles";
import { applicationDecisionNotification } from "@/lib/notify";

async function notifyDecision(
  applicantUserId: string,
  approved: boolean,
  decisionNote?: string | null,
) {
  const planned = applicationDecisionNotification({ approved, decisionNote });
  await db.notification.create({
    data: {
      userId: applicantUserId,
      type: NotificationType.APPLICATION_DECIDED,
      title: planned.title,
      body: planned.body ?? null,
      url: planned.url,
    },
  });
}

// Admin review queue for creator applications (concept §5).
// Rejections are never arbitrary — a decision note is required to reject.

export async function GET() {
  const { userId } = await auth();
  if (!isAdmin(userId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const applications = await db.creatorApplication.findMany({
    where: {
      status: { in: [ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW] },
    },
    orderBy: { submittedAt: "asc" },
    include: {
      user: { select: { id: true, email: true, name: true } },
      vouches: {
        include: {
          voucherChannel: { select: { handle: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json({ applications });
}

const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start_review"), applicationId: z.string().min(1) }),
  z.object({ action: z.literal("approve"), applicationId: z.string().min(1) }),
  z.object({
    action: z.literal("reject"),
    applicationId: z.string().min(1),
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

  const application = await db.creatorApplication.findUnique({
    where: { id: body.applicationId },
  });
  if (!application) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }

  let nextStatus: ApplicationStatus;
  try {
    nextStatus = applicationTransition(application.status, body.action);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 409 });
  }

  if (body.action === "approve") {
    const handleCheck = validateHandle(application.proposedHandle);
    if (!handleCheck.valid) {
      return NextResponse.json(
        { error: `Proposed handle invalid: ${handleCheck.error}` },
        { status: 422 },
      );
    }
    const taken = await db.channel.findUnique({
      where: { handle: application.proposedHandle },
      select: { id: true },
    });
    if (taken) {
      return NextResponse.json(
        { error: "Proposed handle is already taken." },
        { status: 409 },
      );
    }

    const channel = await db.channel.create({
      data: {
        handle: application.proposedHandle,
        name: application.proposedName,
        kind: application.proposedKind,
        status: "APPROVED",
        youtubeChannelId: application.youtubeChannelId,
        ownerId: application.userId,
      },
    });
    const updated = await db.creatorApplication.update({
      where: { id: application.id },
      data: {
        status: nextStatus,
        decidedAt: new Date(),
        decidedById: userId,
        createdChannelId: channel.id,
      },
    });
    await notifyDecision(application.userId, true);
    return NextResponse.json({ application: updated, channel });
  }

  const updated = await db.creatorApplication.update({
    where: { id: application.id },
    data: {
      status: nextStatus,
      ...(body.action === "reject"
        ? { decidedAt: new Date(), decidedById: userId, decisionNote: body.note }
        : {}),
    },
  });
  if (body.action === "reject") {
    await notifyDecision(application.userId, false, body.note);
  }
  return NextResponse.json({ application: updated });
}
