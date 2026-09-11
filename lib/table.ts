// The Table (PLAN §11) — the audience's own place, the counterpart to the
// Studio. Pure rules for the rooms, so "upcoming" means exactly one thing
// whether it is read on the hub, in the Appointments room, or in an email.

import { BookingKind, BookingStatus } from "@prisma/client";
import type { BookingSlot } from "@/lib/bookings";
import { sessionIsPast, sessionWhen } from "@/lib/sessions";

/**
 * What a booking means to the person who asked for it — which is not the
 * same as what it means to the creator. The studio cares whether it has
 * replied; the guest cares whether they have a meeting.
 */
export type AppointmentState =
  | "UPCOMING" // agreed and still ahead
  | "AWAITING" // asked for, nobody has settled it yet
  | "PAST" // happened, or the time has gone by
  | "CLOSED"; // declined or cancelled

export function appointmentState(input: {
  status: BookingStatus;
  slot: BookingSlot | null;
  now?: Date;
}): AppointmentState {
  if (input.status === "DECLINED" || input.status === "CANCELLED") return "CLOSED";
  if (input.status === "COMPLETED") return "PAST";
  const gone =
    input.slot !== null &&
    sessionIsPast({ ymd: input.slot.ymd, endMin: input.slot.endMin, now: input.now });
  if (gone) return "PAST";
  if (input.status === "CONFIRMED" || input.status === "ACCEPTED") return "UPCOMING";
  // PENDING / RESPONDED / QUOTED: a slot may be held, but nothing is agreed.
  return "AWAITING";
}

/** The line under the title: "Tue, 10 Sep · 9:00 AM – 9:30 AM (America/Chicago)". */
export function appointmentWhen(
  slot: BookingSlot | null,
  timezone: string | null | undefined,
  locale?: string,
): string | null {
  if (!slot) return null;
  return sessionWhen({
    ymd: slot.ymd,
    startMin: slot.startMin,
    endMin: slot.endMin,
    timezone: timezone || "UTC",
    locale,
  });
}

/** What the guest should be told is happening, in their own terms. */
export function appointmentStatusLabel(input: {
  kind: BookingKind;
  status: BookingStatus;
  state: AppointmentState;
  paymentStatus?: string | null;
}): string {
  if (input.status === "CANCELLED") return "Cancelled";
  if (input.status === "DECLINED") return "Not taken up";
  if (input.state === "PAST") return "Done";
  if (input.kind === "ONLINE") {
    if (input.status === "CONFIRMED") {
      return input.paymentStatus === "paid" ? "Confirmed · paid" : "Confirmed";
    }
    return input.paymentStatus === "pending"
      ? "Waiting on payment"
      : "Waiting to be confirmed";
  }
  switch (input.status) {
    case "PENDING":
      return "Sent — not yet read";
    case "RESPONDED":
      return "They replied";
    case "QUOTED":
      return "Quote sent to you";
    case "ACCEPTED":
      return "Agreed";
    default:
      return "In progress";
  }
}

/**
 * Sort key for a booking: the slot when there is one, otherwise when it was
 * asked for. Wall-clock minutes are added to the UTC day exactly as they
 * are stored — no conversion, per the booking rule in PLAN §6.
 */
export function appointmentSortKey(row: {
  slot: BookingSlot | null;
  createdAt: Date;
}): number {
  if (row.slot) {
    const day = Date.parse(`${row.slot.ymd}T00:00:00Z`);
    if (!Number.isNaN(day)) return day + row.slot.startMin * 60_000;
  }
  return row.createdAt.getTime();
}

export interface PartitionedAppointments<T> {
  upcoming: T[]; // soonest first — the only room that reads forwards
  awaiting: T[]; // most recently asked first
  past: T[]; // most recent first, closed ones among them
}

export function partitionAppointments<
  T extends { state: AppointmentState; slot: BookingSlot | null; createdAt: Date },
>(rows: T[]): PartitionedAppointments<T> {
  const byKeyAsc = (a: T, b: T) => appointmentSortKey(a) - appointmentSortKey(b);
  const byKeyDesc = (a: T, b: T) => appointmentSortKey(b) - appointmentSortKey(a);
  return {
    upcoming: rows.filter((r) => r.state === "UPCOMING").sort(byKeyAsc),
    awaiting: rows.filter((r) => r.state === "AWAITING").sort(byKeyDesc),
    past: rows.filter((r) => r.state === "PAST" || r.state === "CLOSED").sort(byKeyDesc),
  };
}

/**
 * Whether the Join button should be live. A meeting opens fifteen minutes
 * early and stays open until it ends — early enough to be waiting, late
 * enough that a slow start doesn't lock anyone out.
 */
export const JOIN_OPENS_MINUTES = 15;

export function canJoinNow(input: {
  slot: BookingSlot | null;
  meetingUrl: string | null;
  state: AppointmentState;
  now?: Date;
}): boolean {
  if (!input.meetingUrl || !input.slot || input.state !== "UPCOMING") return false;
  const now = (input.now ?? new Date()).getTime();
  const day = Date.parse(`${input.slot.ymd}T00:00:00Z`);
  if (Number.isNaN(day)) return false;
  const opens = day + (input.slot.startMin - JOIN_OPENS_MINUTES) * 60_000;
  const closes = day + input.slot.endMin * 60_000;
  return now >= opens && now <= closes;
}

/**
 * The Table is empty only when every room is. A brand-new signed-in visitor
 * gets the welcome instead of four empty boxes.
 */
export function tableIsEmpty(counts: {
  appointments: number;
  books: number;
  backed: number;
  following: number;
}): boolean {
  return (
    counts.appointments === 0 &&
    counts.books === 0 &&
    counts.backed === 0 &&
    counts.following === 0
  );
}
