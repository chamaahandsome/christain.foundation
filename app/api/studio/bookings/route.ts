import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { NotificationType } from "@prisma/client";
import { db } from "@/lib/db";
import { bookingContractContent, nextContractNumber } from "@/lib/contracts";
import { getChannelAccess } from "@/lib/team-authorization";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { sendBookingDecisionEmail } from "@/lib/business-emails";
import { cancelSessionBooking } from "@/lib/session-booking";

// Studio booking management — owner-only. For a hire request, accepting
// mints a prefilled contract draft and the existing sign-and-send flow
// finishes it. An online 1:1 has already confirmed itself at payment, so
// the only moves left are marking it done or calling it off.

const PatchSchema = z.object({
  channelId: z.string().min(1),
  action: z.enum([
    "enable",
    "disable",
    "accept",
    "decline",
    "respond", // replied, no quote yet
    "complete", // the engagement happened
    "cancelSession", // online 1:1 called off after confirmation
    "view", // creator opened it (tracking only)
  ]),
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
  // Tracking + light lifecycle moves are allowed at any open status.
  if (body.action === "view") {
    if (!request.viewedAt) {
      await db.bookingRequest.update({
        where: { id: request.id },
        data: { viewedAt: new Date() },
      });
    }
    return NextResponse.json({ ok: true });
  }
  if (body.action === "respond") {
    if (request.kind === "ONLINE") {
      return NextResponse.json(
        { error: "An online session doesn't need a reply — it books itself." },
        { status: 409 },
      );
    }
    if (request.status !== "PENDING") {
      return NextResponse.json(
        { error: "Only new requests can be marked responded." },
        { status: 409 },
      );
    }
    await db.bookingRequest.update({
      where: { id: request.id },
      data: {
        status: "RESPONDED",
        respondedAt: request.respondedAt ?? new Date(),
        decisionNote: body.decisionNote?.trim() || request.decisionNote,
      },
    });
    if (body.decisionNote?.trim()) {
      // A guest requester has no account to notify — the email below is
      // how they hear either way.
      if (request.userId) {
        await db.notification.create({
          data: {
            userId: request.userId,
            type: NotificationType.SYSTEM,
            title: `${access.channel.name} replied to your booking request`,
            body: body.decisionNote.trim(),
            url: `/@${access.channel.handle}`,
          },
        });
      }
      await sendBookingDecisionEmail({
        to: request.requesterEmail,
        requesterName: request.requesterName,
        channelName: access.channel.name,
        accepted: true,
        note: body.decisionNote.trim(),
        responded: true,
      });
    }
    return NextResponse.json({ ok: true });
  }
  if (body.action === "complete") {
    // A hire request completes once it's been agreed; a 1:1 completes once
    // the meeting has happened, and it was confirmed at payment.
    const completable = request.kind === "ONLINE" ? ["CONFIRMED"] : ["ACCEPTED"];
    if (!completable.includes(request.status)) {
      return NextResponse.json(
        { error: "Only accepted bookings can be completed." },
        { status: 409 },
      );
    }
    await db.bookingRequest.update({
      where: { id: request.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  // Calling off a confirmed 1:1: the calendar event is withdrawn, the slot
  // goes back on sale, and the guest is told (refunds are issued in Stripe
  // by hand — the email says so plainly).
  if (body.action === "cancelSession") {
    if (request.kind !== "ONLINE") {
      return NextResponse.json(
        { error: "Only online sessions are cancelled this way." },
        { status: 409 },
      );
    }
    if (!["PENDING", "CONFIRMED"].includes(request.status)) {
      return NextResponse.json({ error: "This session is already closed." }, { status: 409 });
    }
    const ok = await cancelSessionBooking({
      requestId: request.id,
      note: body.decisionNote ?? null,
    });
    return ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: "Could not cancel that session." }, { status: 409 });
  }

  // Everything past this point is the hire flow's accept/decline.
  if (request.kind === "ONLINE") {
    return NextResponse.json(
      { error: "An online session isn't accepted or declined — it books itself." },
      { status: 409 },
    );
  }

  if (!["PENDING", "RESPONDED", "QUOTED"].includes(request.status)) {
    return NextResponse.json({ error: "This request was already decided." }, { status: 409 });
  }

  if (body.action === "decline") {
    await db.bookingRequest.update({
      where: { id: request.id },
      data: {
        status: "DECLINED",
        respondedAt: request.respondedAt ?? new Date(),
        decisionNote: body.decisionNote?.trim() || null,
      },
    });
    // Declining frees the slot immediately.
    await db.serviceBooking.deleteMany({ where: { bookingRequestId: request.id } });
    if (request.userId) {
      await db.notification.create({
        data: {
          userId: request.userId,
          type: NotificationType.SYSTEM,
          title: `Your booking request to ${access.channel.name} was declined`,
          body: body.decisionNote?.trim() || null,
          url: `/@${access.channel.handle}`,
        },
      });
    }
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
      respondedAt: request.respondedAt ?? new Date(),
      decisionNote: body.decisionNote?.trim() || null,
    },
  });
  // The held slot becomes a confirmed booking — no expiry from here.
  await db.serviceBooking.updateMany({
    where: { bookingRequestId: request.id, status: "HELD" },
    data: { status: "BOOKED", holdExpiresAt: null },
  });
  if (request.userId) {
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
  }
  await sendBookingDecisionEmail({
    to: request.requesterEmail,
    requesterName: request.requesterName,
    channelName: access.channel.name,
    accepted: true,
    note: body.decisionNote?.trim() || null,
  });
  return NextResponse.json({ ok: true, contractId: contract.id });
}
