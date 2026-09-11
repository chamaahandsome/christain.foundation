// The Table's reads (PLAN §11.2). One module so the hub and the rooms can
// never disagree about what somebody has — the hub takes a slice, the room
// takes the lot, and both come through the same query.

import { Visibility } from "@prisma/client";
import { db } from "@/lib/db";
import { bookingSlot, parseServiceExtras, type BookingSlot } from "@/lib/bookings";
import { appointmentState, partitionAppointments, type AppointmentState } from "@/lib/table";

export interface TableAppointment {
  id: string;
  kind: "HIRE" | "ONLINE";
  status: string;
  state: AppointmentState;
  slot: BookingSlot | null;
  slotCount: number;
  createdAt: Date;
  channelName: string;
  channelHandle: string;
  channelAvatarUrl: string | null;
  serviceTitle: string | null;
  serviceTimezone: string | null;
  meetingUrl: string | null;
  amountCents: number | null;
  paymentStatus: string | null;
  decisionNote: string | null;
  location: string | null;
  extras: { name: string; priceCents: number | null }[];
  quoteToken: string | null;
  contractId: string | null;
}

/**
 * Everything this person has booked — including the bookings they made as a
 * guest, before they had an account. Booking is open to anyone with the
 * link, so the email on the request is an identity in its own right
 * (PLAN §11.4 C); matching on it here is the read half of that claim.
 */
export async function myAppointments(
  userId: string,
  email: string | null,
): Promise<TableAppointment[]> {
  const rows = await db.bookingRequest.findMany({
    where: email ? { OR: [{ userId }, { requesterEmail: email }] } : { userId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      channel: { select: { name: true, handle: true, avatarUrl: true } },
    },
  });
  if (rows.length === 0) return [];

  const serviceIds = [...new Set(rows.map((r) => r.serviceId).filter(Boolean))] as string[];
  const services = serviceIds.length
    ? await db.bookableService.findMany({
        where: { id: { in: serviceIds } },
        select: { id: true, title: true, timezone: true },
      })
    : [];
  const quoteIds = [...new Set(rows.map((r) => r.quoteId).filter(Boolean))] as string[];
  const quotes = quoteIds.length
    ? await db.quote.findMany({
        where: { id: { in: quoteIds }, sentAt: { not: null } },
        select: { id: true, token: true },
      })
    : [];

  return rows.map((r) => {
    const slot = bookingSlot(r);
    const service = services.find((s) => s.id === r.serviceId);
    return {
      id: r.id,
      kind: r.kind,
      status: r.status,
      state: appointmentState({ status: r.status, slot }),
      slot,
      slotCount: Array.isArray(r.slotSelections) ? r.slotSelections.length : slot ? 1 : 0,
      createdAt: r.createdAt,
      channelName: r.channel.name,
      channelHandle: r.channel.handle,
      channelAvatarUrl: r.channel.avatarUrl,
      serviceTitle: service?.title ?? null,
      serviceTimezone: service?.timezone ?? null,
      meetingUrl: r.meetingUrl,
      amountCents: r.amountCents,
      paymentStatus: r.paymentStatus,
      decisionNote: r.decisionNote,
      location: r.location,
      extras: parseServiceExtras(r.selectedExtras),
      quoteToken: quotes.find((q) => q.id === r.quoteId)?.token ?? null,
      contractId: r.contractId,
    };
  });
}

/** The same rows, sorted into the three groups the rooms render. */
export async function myAppointmentRooms(userId: string, email: string | null) {
  return partitionAppointments(await myAppointments(userId, email));
}

/** Books bought, newest first — the grant, not the ledger row behind it. */
export async function myBooks(userId: string, take?: number) {
  const purchases = await db.ebookPurchase.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    ...(take ? { take } : {}),
    include: {
      ebook: {
        select: {
          id: true,
          title: true,
          author: true,
          coverImageUrl: true,
          channel: { select: { name: true, handle: true } },
        },
      },
    },
  });
  return purchases.map((p) => ({ ...p.ebook, boughtAt: p.createdAt }));
}

/** Campaigns stood behind, with the pledge and how the work is going. */
export async function myBacked(userId: string, take?: number) {
  return db.campaignPledge.findMany({
    where: { userId, status: { in: ["SUCCEEDED", "REFUNDED"] } },
    orderBy: { createdAt: "desc" },
    ...(take ? { take } : {}),
    include: {
      campaign: { include: { channel: { select: { name: true, handle: true } } } },
      reward: { select: { title: true } },
    },
  });
}

/** Creators followed, most recently followed first. */
export async function myFollowing(userId: string, take?: number) {
  const follows = await db.follow.findMany({
    where: { userId, channel: { status: "APPROVED" } },
    orderBy: { createdAt: "desc" },
    ...(take ? { take } : {}),
    include: {
      channel: {
        select: {
          id: true,
          name: true,
          handle: true,
          avatarUrl: true,
          kind: true,
          _count: { select: { contentItems: true, followers: true } },
        },
      },
    },
  });
  return follows.map((f) => ({ ...f.channel, followedAt: f.createdAt }));
}

/**
 * The teaching those creators have put out, newest first. Embedded YouTube
 * only for now — that is what the library holds (PLAN §2, Layer 1) — and
 * dead embeds are filtered by the same `unavailableAt` signal the public
 * surfaces use.
 */
export async function latestFromFollowed(userId: string, take = 24) {
  return db.contentItem.findMany({
    where: {
      visibility: Visibility.PUBLIC,
      unavailableAt: null,
      youtubeVideoId: { not: null },
      channel: { status: "APPROVED", followers: { some: { userId } } },
    },
    orderBy: { publishedAt: "desc" },
    take,
    select: {
      id: true,
      title: true,
      youtubeVideoId: true,
      publishedAt: true,
      durationSec: true,
      channel: { select: { name: true, handle: true } },
    },
  });
}

/** The room counts behind the hub's headings and the welcome check. */
export async function myTableCounts(userId: string, email: string | null) {
  const [books, backed, following, appointments] = await Promise.all([
    db.ebookPurchase.count({ where: { userId } }),
    db.campaignPledge.count({
      where: { userId, status: { in: ["SUCCEEDED", "REFUNDED"] } },
    }),
    db.follow.count({ where: { userId, channel: { status: "APPROVED" } } }),
    db.bookingRequest.count({
      where: email ? { OR: [{ userId }, { requesterEmail: email }] } : { userId },
    }),
  ]);
  return { books, backed, following, appointments };
}
