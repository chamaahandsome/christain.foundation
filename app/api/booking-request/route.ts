import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { NotificationType } from "@prisma/client";
import { db } from "@/lib/db";
import { validateBookingRequest } from "@/lib/contracts";
import { sendBookingRequestEmail } from "@/lib/business-emails";

// Public booking submission (signed-in): a church or organizer asks to book
// the creator. Lands in the studio Bookings tab; accepting mints a contract.

const BodySchema = z.object({
  channelId: z.string().min(1),
  serviceId: z.string().optional(),
  requesterName: z.string().min(1).max(200),
  requesterEmail: z.string().email().max(320),
  organization: z.string().max(200).optional(),
  eventDate: z.string().datetime().nullable().optional(),
  location: z.string().max(300).optional(),
  budgetCents: z.number().int().nullable().optional(),
  message: z.string().min(1).max(5000),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to send a booking request." }, { status: 401 });
  }
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const body = parsed.data;

  const channel = await db.channel.findUnique({
    where: { id: body.channelId },
    select: { id: true, name: true, status: true, ownerId: true, bookingEnabled: true },
  });
  if (!channel || channel.status !== "APPROVED" || !channel.bookingEnabled) {
    return NextResponse.json({ error: "This creator isn't taking bookings." }, { status: 404 });
  }
  if (channel.ownerId === userId) {
    return NextResponse.json({ error: "You can't book your own channel." }, { status: 400 });
  }

  const invalid = validateBookingRequest(body);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 422 });

  // One open request per user per channel — nudging happens off-platform.
  const open = await db.bookingRequest.findFirst({
    where: { channelId: channel.id, userId, status: "PENDING" },
    select: { id: true },
  });
  if (open) {
    return NextResponse.json(
      { error: "You already have a pending request with this creator." },
      { status: 409 },
    );
  }

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

  // A chosen service must belong to this channel and be bookable.
  if (body.serviceId) {
    const service = await db.bookableService.findUnique({
      where: { id: body.serviceId },
      select: { channelId: true, visible: true, active: true },
    });
    if (!service || service.channelId !== channel.id || !service.visible || !service.active) {
      return NextResponse.json({ error: "That service isn't bookable." }, { status: 404 });
    }
  }

  const request = await db.bookingRequest.create({
    data: {
      channelId: channel.id,
      serviceId: body.serviceId ?? null,
      userId,
      requesterName: body.requesterName.trim(),
      requesterEmail: body.requesterEmail.trim().toLowerCase(),
      organization: body.organization?.trim() || null,
      eventDate: body.eventDate ? new Date(body.eventDate) : null,
      location: body.location?.trim() || null,
      budgetCents: body.budgetCents ?? null,
      message: body.message.trim(),
    },
  });

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
      studioUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/studio`,
      replyTo: request.requesterEmail,
    });
  }

  return NextResponse.json({ ok: true, requestId: request.id });
}
