import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { NotificationType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { validateBookingRequest } from "@/lib/contracts";
import {
  sendBookingReceivedEmail,
  sendBookingRequestEmail,
} from "@/lib/business-emails";
import { parseServiceExtras } from "@/lib/bookings";
import { allowGuestRequest } from "@/lib/rate-limit";
import { calcPlatformFee } from "@/lib/platform-fees";
import { stripeClient } from "@/lib/stripe";
import { confirmSessionBooking } from "@/lib/session-booking";
import { SESSION_HOLD_MINUTES, sessionIsFree, sessionWhen } from "@/lib/sessions";
import {
  SLOT_HOLD_DAYS,
  dayKey,
  slotIsBookable,
  slotsAreConsecutive,
  usesSlots,
} from "@/lib/availability";

// Public booking submission (signed-in). Two outcomes, decided by the
// service's kind:
//
// HIRE   — a church or organizer asks to book the creator. Lands in the
//          studio Bookings tab as a request; accepting mints a contract.
// ONLINE — a one-to-one. The slot is taken there and then: a free session
//          is confirmed on the spot with its meeting link, a paid one holds
//          the slot for half an hour while Stripe collects, and the webhook
//          confirms it.

const BodySchema = z.object({
  channelId: z.string().min(1),
  serviceId: z.string().optional(),
  requesterName: z.string().min(1).max(200),
  requesterEmail: z.string().email().max(320),
  organization: z.string().max(200).optional(),
  eventDate: z.string().datetime().nullable().optional(),
  location: z.string().max(300).optional(),
  budgetCents: z.number().int().nullable().optional(),
  message: z.string().max(5000).default(""),
  // add-ons the requester ticked: names must match the service's extras
  selectedExtras: z.array(z.string().max(150)).max(20).optional(),
  // time-slot services: every chosen slot, across one or more days
  slots: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        startMin: z.number().int().min(0).max(1439),
      }),
    )
    .max(40)
    .optional(),
});

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function POST(req: Request) {
  // Booking is open to anyone with the link — a church secretary shouldn't
  // need an account to invite a speaker. Signing in only links the request
  // to a CF user so it shows in their notifications. Guests are held back
  // by rate limit and by the email they give.
  const { userId } = await auth();
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  if (!userId && !allowGuestRequest(ip)) {
    return NextResponse.json(
      { error: "Too many requests just now — try again in a few minutes." },
      { status: 429 },
    );
  }
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const body = parsed.data;

  const channel = await db.channel.findUnique({
    where: { id: body.channelId },
    select: {
      id: true,
      name: true,
      handle: true,
      status: true,
      ownerId: true,
      bookingEnabled: true,
      stripeAccountId: true,
      stripeChargesEnabled: true,
    },
  });
  if (!channel || channel.status !== "APPROVED" || !channel.bookingEnabled) {
    return NextResponse.json({ error: "This creator isn't taking bookings." }, { status: 404 });
  }
  if (userId && channel.ownerId === userId) {
    return NextResponse.json({ error: "You can't book your own channel." }, { status: 400 });
  }

  // A chosen service must belong to this channel and be bookable; it also
  // decides which of the two flows below runs.
  const service = body.serviceId
    ? await db.bookableService.findUnique({
        where: { id: body.serviceId },
        select: {
          channelId: true,
          visible: true,
          active: true,
          kind: true,
          title: true,
          description: true,
          extras: true,
          rateCents: true,
          slotMinutes: true,
          dailyStart: true,
          dailyEnd: true,
          bufferMins: true,
          timezone: true,
          leadTimeHours: true,
          maxAdvanceDays: true,
          minBookingSlots: true,
          maxBookingSlots: true,
          availableDays: true,
          images: true,
        },
      })
    : null;
  if (body.serviceId) {
    if (
      !service ||
      service.channelId !== channel.id ||
      !service.visible ||
      !service.active
    ) {
      return NextResponse.json({ error: "That service isn't bookable." }, { status: 404 });
    }
  }
  const isSession = service?.kind === "ONLINE";

  // A hire request is a letter and reads like one; a 1:1 books a slot and
  // the note is optional, so they're held to different standards.
  if (isSession) {
    if (body.requesterName.trim().length < 2) {
      return NextResponse.json({ error: "Tell them who you are." }, { status: 422 });
    }
  } else {
    const invalid = validateBookingRequest(body);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 422 });
    // One open hire request per user per channel — nudging happens
    // off-platform. Sessions are exempt: they're self-serve, and several
    // may legitimately be on the books at once.
    const open = await db.bookingRequest.findFirst({
      where: {
        channelId: channel.id,
        status: "PENDING",
        kind: "HIRE",
        // A guest is known by the email they gave.
        ...(userId
          ? { userId }
          : { requesterEmail: body.requesterEmail.trim().toLowerCase() }),
      },
      select: { id: true },
    });
    if (open) {
      return NextResponse.json(
        { error: "You already have a pending request with this creator." },
        { status: 409 },
      );
    }
  }

  if (userId) {
    const clerkUser = await currentUser();
    await db.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email:
          clerkUser?.emailAddresses?.[0]?.emailAddress ?? `${userId}@placeholder.invalid`,
        name: clerkUser?.fullName ?? null,
      },
      update: {},
    });
  }

  // The selected add-ons are resolved against the service's own list.
  const serviceTitle = service?.title ?? null;
  const offered = service ? parseServiceExtras(service.extras) : [];
  const chosenExtras = isSession
    ? []
    : offered.filter((e) => body.selectedExtras?.includes(e.name));
  // Time-slot services reserve their slots as part of the request.
  const slotHolds: { date: Date; startMin: number; endMin: number }[] = [];

  if (service && body.serviceId) {
    const serviceId = body.serviceId;
    const config = {
      slotMinutes: service.slotMinutes,
      dailyStart: service.dailyStart,
      dailyEnd: service.dailyEnd,
      bufferMins: service.bufferMins,
    };
    if (isSession && !usesSlots(config)) {
      return NextResponse.json(
        { error: "This session isn't open for booking yet." },
        { status: 409 },
      );
    }
    if (usesSlots(config)) {
      const chosen = body.slots ?? [];
      if (chosen.length === 0) {
        return NextResponse.json(
          { error: "Pick a day and time for this service." },
          { status: 422 },
        );
      }
      // A 1:1 is exactly one slot — the service's own min/max already say
      // so, but saying it here keeps the error plain.
      if (isSession && chosen.length !== 1) {
        return NextResponse.json({ error: "Pick one time slot." }, { status: 422 });
      }
      // Group by day: each day is validated on its own — every slot
      // offered and free, an unbroken run, and within the day's limits.
      const byDay = new Map<string, number[]>();
      for (const s of chosen) {
        const list = byDay.get(s.date) ?? [];
        if (!list.includes(s.startMin)) list.push(s.startMin);
        byDay.set(s.date, list);
      }
      const availableDays = (service.availableDays as string[] | null) ?? [];
      for (const [ymd, startMins] of byDay) {
        const date = dayKey(ymd);
        if (!date) {
          return NextResponse.json({ error: "Bad date." }, { status: 422 });
        }
        if (startMins.length < service.minBookingSlots) {
          return NextResponse.json(
            {
              error: `Choose at least ${service.minBookingSlots} slot${service.minBookingSlots > 1 ? "s" : ""} per day.`,
            },
            { status: 422 },
          );
        }
        if (service.maxBookingSlots && startMins.length > service.maxBookingSlots) {
          return NextResponse.json(
            { error: `At most ${service.maxBookingSlots} slots per day.` },
            { status: 422 },
          );
        }
        if (!slotsAreConsecutive(startMins, config)) {
          return NextResponse.json(
            { error: "Pick consecutive time slots." },
            { status: 422 },
          );
        }
        const taken = await db.serviceBooking.findMany({
          where: {
            serviceId,
            date,
            OR: [
              { status: "BOOKED" },
              { status: "HELD", holdExpiresAt: { gt: new Date() } },
            ],
          },
          select: { startMin: true },
        });
        for (const startMin of startMins) {
          const check = slotIsBookable({
            config,
            availableDays,
            leadTimeHours: service.leadTimeHours,
            maxAdvanceDays: service.maxAdvanceDays,
            date,
            startMin,
            takenStartMins: taken.map((t) => t.startMin),
          });
          if (!check.ok) {
            return NextResponse.json({ error: check.error }, { status: 409 });
          }
          slotHolds.push({ date, startMin, endMin: check.endMin });
        }
      }
      slotHolds.sort(
        (a, b) => a.date.getTime() - b.date.getTime() || a.startMin - b.startMin,
      );
    }
  }

  const feeCents = isSession ? (service?.rateCents ?? null) : null;
  const free = isSession && sessionIsFree(feeCents);
  // A paid session can't be taken by a creator who can't be paid.
  if (isSession && !free && (!channel.stripeAccountId || !channel.stripeChargesEnabled)) {
    return NextResponse.json(
      { error: "This creator isn't set up to take payment yet." },
      { status: 409 },
    );
  }

  const request = await db.bookingRequest.create({
    data: {
      channelId: channel.id,
      serviceId: body.serviceId ?? null,
      kind: isSession ? "ONLINE" : "HIRE",
      userId,
      requesterName: body.requesterName.trim(),
      requesterEmail: body.requesterEmail.trim().toLowerCase(),
      organization: body.organization?.trim() || null,
      eventDate: body.eventDate ? new Date(body.eventDate) : null,
      location: body.location?.trim() || null,
      budgetCents: body.budgetCents ?? null,
      message: body.message.trim(),
      ...(isSession
        ? {
            amountCents: feeCents,
            paymentStatus: free ? "free" : "pending",
          }
        : {}),
      ...(chosenExtras.length > 0
        ? {
            selectedExtras: chosenExtras as unknown as Prisma.InputJsonValue,
          }
        : {}),
      ...(slotHolds.length > 0
        ? {
            eventDate: slotHolds[0].date,
            slotStartMin: slotHolds[0].startMin,
            slotSelections: slotHolds.map((s) => ({
              date: s.date.toISOString().slice(0, 10),
              startMin: s.startMin,
              endMin: s.endMin,
            })),
          }
        : {}),
    },
  });

  // Hold the slot. The unique key on (service, day, start) is what makes
  // two simultaneous requests impossible — losing the race is a clean 409,
  // and the orphaned request row is removed with it. A hire request holds
  // for a week because a person is deciding; a session holds only as long
  // as the card takes.
  if (slotHolds.length > 0 && body.serviceId) {
    const holdExpiresAt = new Date(
      Date.now() +
        (isSession ? SESSION_HOLD_MINUTES * 60_000 : SLOT_HOLD_DAYS * 86_400_000),
    );
    try {
      // All-or-nothing: one transaction, so a lost race leaves nothing
      // half-reserved.
      await db.$transaction(
        slotHolds.map((s) =>
          db.serviceBooking.create({
            data: {
              channelId: channel.id,
              serviceId: body.serviceId!,
              date: s.date,
              startMin: s.startMin,
              endMin: s.endMin,
              status: "HELD",
              holdExpiresAt,
              bookingRequestId: request.id,
              clientName: request.requesterName,
              clientEmail: request.requesterEmail,
            },
          }),
        ),
      );
    } catch {
      await db.serviceBooking.deleteMany({ where: { bookingRequestId: request.id } });
      await db.bookingRequest.delete({ where: { id: request.id } });
      return NextResponse.json(
        { error: "One of those times was just taken — pick again." },
        { status: 409 },
      );
    }
  }

  /* ─────────────── online 1:1: confirm now, or collect first ─────────────── */

  if (isSession && service) {
    if (free) {
      const confirmed = await confirmSessionBooking({
        requestId: request.id,
        payment: { status: "free", amountCents: 0 },
      });
      return NextResponse.json({
        ok: true,
        requestId: request.id,
        confirmed: true,
        meetingUrl: confirmed.meetingUrl,
      });
    }

    const stripe = stripeClient();
    if (!stripe) {
      await db.serviceBooking.deleteMany({ where: { bookingRequestId: request.id } });
      await db.bookingRequest.delete({ where: { id: request.id } });
      return NextResponse.json(
        { error: "Payments aren't configured yet." },
        { status: 503 },
      );
    }
    const slot = slotHolds[0];
    const when = sessionWhen({
      ymd: slot.date.toISOString().slice(0, 10),
      startMin: slot.startMin,
      endMin: slot.endMin,
      timezone: service.timezone,
    });
    const bookUrl = `${siteUrl()}/@${channel.handle}/book/${body.serviceId}`;
    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: request.requesterEmail,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: feeCents!,
              product_data: {
                name: `${service.title} with ${channel.name}`,
                description: when,
              },
            },
          },
        ],
        payment_intent_data: {
          application_fee_amount: calcPlatformFee(feeCents!, "booking", "stripe"),
          transfer_data: { destination: channel.stripeAccountId! },
        },
        metadata: {
          cfKind: "session",
          cfRequestId: request.id,
          cfChannelId: channel.id,
          cfUserId: userId ?? "",
        },
        // The slot is only held for a short while, so the window Stripe
        // gives the payer should not outlive it.
        expires_at: Math.floor(Date.now() / 1000) + SESSION_HOLD_MINUTES * 60,
        success_url: `${bookUrl}?booked=${request.id}`,
        cancel_url: `${bookUrl}?cancelled=1`,
      });
      return NextResponse.json({
        ok: true,
        requestId: request.id,
        checkoutUrl: session.url,
      });
    } catch (err) {
      console.error("session checkout failed", err);
      await db.serviceBooking.deleteMany({ where: { bookingRequestId: request.id } });
      await db.bookingRequest.delete({ where: { id: request.id } });
      return NextResponse.json(
        { error: "Could not start checkout. Try again shortly." },
        { status: 502 },
      );
    }
  }

  /* ─────────────── service hire: a request for a person to weigh ─────────────── */

  await db.notification.create({
    data: {
      userId: channel.ownerId,
      type: NotificationType.SYSTEM,
      title: `📅 Booking request from ${request.requesterName}`,
      body: request.message.slice(0, 280),
      url: "/studio",
    },
  });

  const owner = await db.user.findUnique({
    where: { id: channel.ownerId },
    select: { email: true },
  });
  if (owner?.email) {
    await sendBookingRequestEmail({
      to: owner.email,
      channelName: channel.name,
      requesterName: request.requesterName,
      organization: request.organization,
      eventDate: request.eventDate,
      location: request.location,
      budgetCents: request.budgetCents,
      message: request.message,
      studioUrl: `${siteUrl()}/studio`,
      replyTo: request.requesterEmail,
    });
  }

  // Confirm to the requester that it landed (Maltivas never does this).
  await sendBookingReceivedEmail({
    to: request.requesterEmail,
    requesterName: request.requesterName,
    channelName: channel.name,
    serviceTitle,
    eventDate: request.eventDate,
  });

  return NextResponse.json({ ok: true, requestId: request.id });
}
