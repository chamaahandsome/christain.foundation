// Confirming an online 1:1 — the one place a session becomes real.
//
// Two callers reach it and they must behave identically: the free path
// (lib is called straight from /api/booking-request) and the paid path (the
// Stripe webhook, once the charge lands). It is idempotent, because Stripe
// redelivers, and it never throws on a calendar failure — a paid booking
// must not be lost because Google was unreachable.

import { NotificationType } from "@prisma/client";
import { db } from "@/lib/db";
import { formatMin } from "@/lib/availability";
import { bookingSlot } from "@/lib/bookings";
import {
  createMeetEvent,
  deleteCalendarEvent,
  googleAccessToken,
  googleCalendarTemplateUrl,
} from "@/lib/google-calendar";
import { resolveMeetingUrl, sessionWhen } from "@/lib/sessions";
import {
  sendSessionBookedEmail,
  sendSessionCancelledEmail,
  sendSessionConfirmedEmail,
} from "@/lib/business-emails";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

// The one slot a session occupies is read back with the shared parser
// (lib/bookings) — the same shape The Table renders to the guest.
const slotOf = bookingSlot;

export interface SessionPayment {
  status: "free" | "paid";
  amountCents: number | null;
  providerRef?: string | null;
}

export interface ConfirmedSession {
  ok: boolean;
  alreadyConfirmed: boolean;
  meetingUrl: string | null;
  when: string | null;
}

/**
 * Promote a held session booking to confirmed: the slot is taken for good,
 * a Google Calendar event with a Meet link is raised on the creator's
 * calendar, and both sides are told.
 */
export async function confirmSessionBooking(input: {
  requestId: string;
  payment: SessionPayment;
}): Promise<ConfirmedSession> {
  const request = await db.bookingRequest.findUnique({
    where: { id: input.requestId },
  });
  if (!request || request.kind !== "ONLINE") {
    return { ok: false, alreadyConfirmed: false, meetingUrl: null, when: null };
  }
  if (request.status === "CONFIRMED") {
    return {
      ok: true,
      alreadyConfirmed: true,
      meetingUrl: request.meetingUrl,
      when: null,
    };
  }

  const [channel, service] = await Promise.all([
    db.channel.findUnique({
      where: { id: request.channelId },
      select: { id: true, name: true, handle: true, ownerId: true },
    }),
    request.serviceId
      ? db.bookableService.findUnique({
          where: { id: request.serviceId },
          select: {
            title: true,
            description: true,
            timezone: true,
            meetingProvider: true,
            meetingUrl: true,
          },
        })
      : Promise.resolve(null),
  ]);
  if (!channel) {
    return { ok: false, alreadyConfirmed: false, meetingUrl: null, when: null };
  }

  const slot = slotOf(request);
  const timezone = service?.timezone ?? "UTC";
  const title = service?.title ?? "One-to-one session";
  const when = slot
    ? sessionWhen({ ...slot, timezone })
    : request.eventDate?.toLocaleDateString() ?? "time to be confirmed";

  // The slot is now taken for good — no expiry, no sweeping.
  const promoted = await db.serviceBooking.updateMany({
    where: { bookingRequestId: request.id, status: "HELD" },
    data: { status: "BOOKED", holdExpiresAt: null },
  });
  // Nothing to promote means the hold was swept before the payment was
  // confirmed. The guest has paid, so the meeting stands either way — but
  // put the slot back on the books so the creator's calendar is honest.
  // A unique-key collision here means someone else took it in the gap:
  // that is a genuine double-booking and must be shouted about.
  if (promoted.count === 0 && slot && request.serviceId) {
    const existing = await db.serviceBooking.findFirst({
      where: { bookingRequestId: request.id },
      select: { id: true },
    });
    if (!existing) {
      await db.serviceBooking
        .create({
          data: {
            channelId: request.channelId,
            serviceId: request.serviceId,
            date: new Date(`${slot.ymd}T00:00:00.000Z`),
            startMin: slot.startMin,
            endMin: slot.endMin,
            status: "BOOKED",
            bookingRequestId: request.id,
            clientName: request.requesterName,
            clientEmail: request.requesterEmail,
          },
        })
        .catch((err) => {
          console.error(
            `session ${request.id}: slot ${slot.ymd} ${slot.startMin} was taken before payment confirmed —`,
            err,
          );
        });
    }
  }

  // Google Calendar + Meet, best effort.
  let meetUrl: string | null = null;
  let calendarEventId: string | null = null;
  let calendarHtmlLink: string | null = null;
  if (slot && service?.meetingProvider !== "custom") {
    const token = await googleAccessToken(channel.ownerId);
    if (token) {
      const owner = await db.user.findUnique({
        where: { id: channel.ownerId },
        select: { email: true },
      });
      const event = await createMeetEvent({
        accessToken: token,
        summary: `${title} — ${request.requesterName}`,
        description:
          `${service?.description ?? ""}\n\n${request.message}`.trim().slice(0, 4000),
        ymd: slot.ymd,
        startMin: slot.startMin,
        endMin: slot.endMin,
        timezone,
        attendees: [owner?.email, request.requesterEmail].filter(
          (e): e is string => Boolean(e),
        ),
        requestKey: `cf-${request.id}`,
      });
      meetUrl = event.meetingUrl;
      calendarEventId = event.eventId;
      calendarHtmlLink = event.htmlLink;
    }
  }

  const meetingUrl = resolveMeetingUrl({
    googleMeetUrl: meetUrl,
    serviceMeetingUrl: service?.meetingUrl,
  });

  await db.bookingRequest.update({
    where: { id: request.id },
    data: {
      status: "CONFIRMED",
      confirmedAt: new Date(),
      respondedAt: request.respondedAt ?? new Date(),
      meetingUrl,
      calendarEventId,
      calendarHtmlLink,
      paymentStatus: input.payment.status,
      amountCents: input.payment.amountCents,
      paymentRef: input.payment.providerRef ?? null,
    },
  });

  const addToCalendarUrl = slot
    ? googleCalendarTemplateUrl({
        title: `${title} — ${channel.name}`,
        details: meetingUrl ? `Join: ${meetingUrl}` : undefined,
        ymd: slot.ymd,
        startMin: slot.startMin,
        endMin: slot.endMin,
        timezone,
      })
    : `${siteUrl()}/@${channel.handle}`;

  // A guest booked without an account — the email is their only channel.
  if (request.userId) {
    await db.notification.create({
      data: {
        userId: request.userId,
        type: NotificationType.SYSTEM,
        title: `✅ Your 1:1 with ${channel.name} is confirmed`,
        body: when,
        url: `/@${channel.handle}/book`,
      },
    });
  }
  await db.notification.create({
    data: {
      userId: channel.ownerId,
      type: NotificationType.SYSTEM,
      title: `📅 ${request.requesterName} booked a 1:1`,
      body: `${title} · ${when}`,
      url: "/studio",
    },
  });

  const owner = await db.user.findUnique({
    where: { id: channel.ownerId },
    select: { email: true },
  });
  await sendSessionConfirmedEmail({
    to: request.requesterEmail,
    guestName: request.requesterName,
    channelName: channel.name,
    sessionTitle: title,
    when,
    meetingUrl,
    addToCalendarUrl,
    amountCents: input.payment.amountCents,
    ...(owner?.email ? { replyTo: owner.email } : {}),
  });
  if (owner?.email) {
    await sendSessionBookedEmail({
      to: owner.email,
      channelName: channel.name,
      guestName: request.requesterName,
      guestEmail: request.requesterEmail,
      sessionTitle: title,
      when,
      meetingUrl,
      addToCalendarUrl,
      amountCents: input.payment.amountCents,
      message: request.message,
      studioUrl: `${siteUrl()}/studio`,
    });
  }

  return { ok: true, alreadyConfirmed: false, meetingUrl, when };
}

/**
 * The creator calls a session off: the slot is released, the calendar event
 * is withdrawn, and the guest is told. Refunds are handled in Stripe by
 * hand for now — the email says so rather than pretending otherwise.
 */
export async function cancelSessionBooking(input: {
  requestId: string;
  note?: string | null;
}): Promise<boolean> {
  const request = await db.bookingRequest.findUnique({ where: { id: input.requestId } });
  if (!request || request.kind !== "ONLINE") return false;

  const channel = await db.channel.findUnique({
    where: { id: request.channelId },
    select: { name: true, handle: true, ownerId: true },
  });
  if (!channel) return false;

  const service = request.serviceId
    ? await db.bookableService.findUnique({
        where: { id: request.serviceId },
        select: { title: true, timezone: true },
      })
    : null;
  const slot = slotOf(request);
  const when = slot
    ? sessionWhen({ ...slot, timezone: service?.timezone ?? "UTC" })
    : request.eventDate
      ? `${request.eventDate.toLocaleDateString()}${
          request.slotStartMin !== null ? ` at ${formatMin(request.slotStartMin)}` : ""
        }`
      : "the booked time";

  if (request.calendarEventId) {
    const token = await googleAccessToken(channel.ownerId);
    if (token) {
      await deleteCalendarEvent({ accessToken: token, eventId: request.calendarEventId });
    }
  }

  await db.serviceBooking.deleteMany({ where: { bookingRequestId: request.id } });
  await db.bookingRequest.update({
    where: { id: request.id },
    data: {
      status: "CANCELLED",
      decisionNote: input.note?.trim() || request.decisionNote,
    },
  });
  if (request.userId) {
    await db.notification.create({
      data: {
        userId: request.userId,
        type: NotificationType.SYSTEM,
        title: `${channel.name} cancelled your 1:1`,
        body: input.note?.trim() || when,
        url: `/@${channel.handle}/book`,
      },
    });
  }
  await sendSessionCancelledEmail({
    to: request.requesterEmail,
    guestName: request.requesterName,
    channelName: channel.name,
    sessionTitle: service?.title ?? "One-to-one session",
    when,
    note: input.note?.trim() || null,
    refundNote:
      request.paymentStatus === "paid" && (request.amountCents ?? 0) > 0
        ? `Your payment of $${((request.amountCents ?? 0) / 100).toLocaleString()} will be refunded to the card you used.`
        : null,
  });
  return true;
}
