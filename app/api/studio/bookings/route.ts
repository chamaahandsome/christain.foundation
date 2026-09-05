import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { NotificationType } from "@prisma/client";
import { db } from "@/lib/db";
import { bookingContractContent, nextContractNumber } from "@/lib/contracts";
import { getChannelAccess } from "@/lib/team-authorization";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { sendBookingDecisionEmail } from "@/lib/business-emails";

// Studio booking management — owner-only. Accepting a request mints a
// prefilled contract draft; the existing sign-and-send flow finishes it.

const PatchSchema = z.object({
  channelId: z.string().min(1),
  action: z.enum(["enable", "disable", "accept", "decline"]),
  requestId: z.string().optional(),
  decisionNote: z.string().max(1000).optional(),
});

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const body = parsed.data;

  const access = await getChannelAccess(
    userId,
    body.channelId,
    FEATURES.BUSINESS,
    ACCESS_LEVELS.MANAGER,
  );
  if (!access.channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  if (!access.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (body.action === "enable" || body.action === "disable") {
    await db.channel.update({
      where: { id: body.channelId },
      data: { bookingEnabled: body.action === "enable" },
    });
    return NextResponse.json({ ok: true });
  }

  if (!body.requestId) {
    return NextResponse.json({ error: "requestId required" }, { status: 400 });
  }
  const request = await db.bookingRequest.findUnique({ where: { id: body.requestId } });
  if (!request || request.channelId !== body.channelId) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (request.status !== "PENDING") {
    return NextResponse.json({ error: "This request was already decided." }, { status: 409 });
  }

  if (body.action === "decline") {
    await db.bookingRequest.update({
      where: { id: request.id },
      data: { status: "DECLINED", decisionNote: body.decisionNote?.trim() || null },
    });
    await db.notification.create({
      data: {
        userId: request.userId,
        type: NotificationType.SYSTEM,
        title: `Your booking request to ${access.channel.name} was declined`,
        body: body.decisionNote?.trim() || null,
        url: `/@${access.channel.handle}`,
      },
    });
    await sendBookingDecisionEmail({
      to: request.requesterEmail,
      requesterName: request.requesterName,
      channelName: access.channel.name,
      accepted: false,
      note: body.decisionNote?.trim() || null,
    });
    return NextResponse.json({ ok: true });
  }

  // accept → prefilled contract draft
  const last = await db.contract.findFirst({
    where: { channelId: body.channelId, contractNumber: { startsWith: "CON-" } },
    orderBy: { contractNumber: "desc" },
    select: { contractNumber: true },
  });
  const service = request.serviceId
    ? await db.bookableService.findUnique({
        where: { id: request.serviceId },
        select: { title: true },
      })
    : null;
  const contract = await db.contract.create({
    data: {
      channelId: body.channelId,
      contractNumber: nextContractNumber(last?.contractNumber ?? null),
      title: `${service?.title ?? "Engagement"} — ${request.requesterName}${
        request.eventDate ? ` · ${request.eventDate.toLocaleDateString()}` : ""
      }`,
      clientName: request.requesterName,
      clientEmail: request.requesterEmail,
      clientCompany: request.organization,
      amountCents: request.budgetCents,
      content: bookingContractContent(request),
      activities: {
        create: { type: "created", description: "Drafted from an accepted booking request" },
      },
    },
  });
  await db.bookingRequest.update({
    where: { id: request.id },
    data: {
      status: "ACCEPTED",
      contractId: contract.id,
      decisionNote: body.decisionNote?.trim() || null,
    },
  });
  await db.notification.create({
    data: {
      userId: request.userId,
      type: NotificationType.SYSTEM,
      title: `🎉 ${access.channel.name} accepted your booking request`,
      body:
        body.decisionNote?.trim() ||
        "They're drafting the agreement — a signing link will reach your email.",
      url: `/@${access.channel.handle}`,
    },
  });
  await sendBookingDecisionEmail({
    to: request.requesterEmail,
    requesterName: request.requesterName,
    channelName: access.channel.name,
    accepted: true,
    note: body.decisionNote?.trim() || null,
  });
  return NextResponse.json({ ok: true, contractId: contract.id });
}
