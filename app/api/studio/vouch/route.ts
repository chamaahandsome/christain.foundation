import { auth } from "@clerk/nextjs/server";
import { ApplicationStatus, NotificationType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { canVouch } from "@/lib/gate";
import { vouchReceivedNotification } from "@/lib/notify";

const BodySchema = z.object({
  applicationId: z.string().min(1),
  channelId: z.string().min(1), // the voucher's channel
  note: z.string().max(2000).optional(),
});

// An approved creator vouches for an applicant (concept §5.3).
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { applicationId, channelId, note } = parsed.data;

  const [channel, application] = await Promise.all([
    db.channel.findUnique({
      where: { id: channelId },
      select: { id: true, ownerId: true, status: true },
    }),
    db.creatorApplication.findUnique({
      where: { id: applicationId },
      select: { id: true, userId: true, status: true },
    }),
  ]);

  if (!channel || channel.ownerId !== userId) {
    return NextResponse.json({ error: "Not your channel." }, { status: 403 });
  }
  if (!application) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }
  if (
    application.status !== ApplicationStatus.DRAFT &&
    application.status !== ApplicationStatus.SUBMITTED
  ) {
    return NextResponse.json(
      { error: "This application is no longer open for vouching." },
      { status: 409 },
    );
  }

  const check = canVouch({
    voucherChannelStatus: channel.status,
    voucherOwnerId: channel.ownerId,
    applicantUserId: application.userId,
  });
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 403 });
  }

  const existingVouch = await db.vouch.findUnique({
    where: {
      applicationId_voucherChannelId: {
        applicationId,
        voucherChannelId: channelId,
      },
    },
    select: { id: true },
  });

  const vouch = await db.vouch.upsert({
    where: {
      applicationId_voucherChannelId: {
        applicationId,
        voucherChannelId: channelId,
      },
    },
    create: { applicationId, voucherChannelId: channelId, note: note ?? null },
    update: { note: note ?? null },
  });

  // Tell the applicant on a new vouch (not on a note edit).
  if (!existingVouch) {
    const voucher = await db.channel.findUniqueOrThrow({
      where: { id: channelId },
      select: { name: true, handle: true },
    });
    const planned = vouchReceivedNotification({
      voucherName: voucher.name,
      voucherHandle: voucher.handle,
    });
    await db.notification.create({
      data: {
        userId: application.userId,
        type: NotificationType.VOUCH_RECEIVED,
        title: planned.title,
        body: planned.body ?? null,
        url: planned.url,
      },
    });
  }

  return NextResponse.json({ vouch });
}
