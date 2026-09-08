import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  availabilityForDay,
  dayKey,
  generateSlots,
  monthStatuses,
  usesSlots,
} from "@/lib/availability";

export const dynamic = "force-dynamic";

// Public slot lookup for a bookable service: which times are open on a
// given day, with held/booked ones marked. Read-only and safe to call
// anonymously — it exposes nothing but the creator's own published
// schedule. (Maltivas' equivalent write endpoint has no auth at all;
// there is no write here.)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ serviceId: string }> },
) {
  const { serviceId } = await params;
  const search = new URL(req.url).searchParams;
  // Two modes: ?date=YYYY-MM-DD for one day's slots, ?month=YYYY-MM for
  // the calendar's per-day colours.
  const monthParam = search.get("month");
  const ymd = search.get("date") ?? "";
  const date = dayKey(ymd);
  if (!date && !monthParam) {
    return NextResponse.json(
      { error: "date=YYYY-MM-DD or month=YYYY-MM required" },
      { status: 400 },
    );
  }
  const monthMatch = monthParam?.match(/^(\d{4})-(\d{2})$/) ?? null;
  if (monthParam && !monthMatch) {
    return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });
  }

  const service = await db.bookableService.findUnique({
    where: { id: serviceId },
    select: {
      id: true,
      visible: true,
      active: true,
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
      channel: { select: { status: true, bookingEnabled: true } },
    },
  });
  if (
    !service ||
    !service.visible ||
    !service.active ||
    service.channel.status !== "APPROVED" ||
    !service.channel.bookingEnabled
  ) {
    return NextResponse.json({ error: "Not bookable" }, { status: 404 });
  }

  const config = {
    slotMinutes: service.slotMinutes,
    dailyStart: service.dailyStart,
    dailyEnd: service.dailyEnd,
    bufferMins: service.bufferMins,
  };
  if (!usesSlots(config)) {
    return NextResponse.json({ slots: [], usesSlots: false });
  }
  const occupied = {
    OR: [
      { status: "BOOKED" },
      { status: "HELD" as const, holdExpiresAt: { gt: new Date() } },
    ],
  };

  // Month mode — one query, then the whole grid's statuses.
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = Number(monthMatch[2]) - 1;
    const from = new Date(Date.UTC(year, month, 1));
    const to = new Date(Date.UTC(year, month + 1, 1));
    const rows = await db.serviceBooking.findMany({
      where: { serviceId, date: { gte: from, lt: to }, ...occupied },
      select: { date: true, startMin: true },
    });
    const takenByDay: Record<string, number[]> = {};
    for (const r of rows) {
      const key = r.date.toISOString().slice(0, 10);
      (takenByDay[key] ??= []).push(r.startMin);
    }
    return NextResponse.json({
      usesSlots: true,
      timezone: service.timezone,
      minBookingSlots: service.minBookingSlots,
      maxBookingSlots: service.maxBookingSlots,
      slotMinutes: service.slotMinutes,
      days: monthStatuses({
        config,
        availableDays: (service.availableDays as string[] | null) ?? [],
        leadTimeHours: service.leadTimeHours,
        maxAdvanceDays: service.maxAdvanceDays,
        year,
        month,
        takenByDay,
      }),
    });
  }

  // Live holds and confirmed bookings both occupy the slot.
  const taken = await db.serviceBooking.findMany({
    where: { serviceId, date: date!, ...occupied },
    select: { startMin: true },
  });

  const day = availabilityForDay({
    config,
    availableDays: (service.availableDays as string[] | null) ?? [],
    leadTimeHours: service.leadTimeHours,
    maxAdvanceDays: service.maxAdvanceDays,
    date: date!,
    takenStartMins: taken.map((t) => t.startMin),
  });

  return NextResponse.json({
    usesSlots: true,
    timezone: service.timezone,
    minBookingSlots: service.minBookingSlots,
    maxBookingSlots: service.maxBookingSlots,
    slotMinutes: service.slotMinutes,
    open: day.open,
    reason: day.reason,
    slots: day.slots,
    slotCount: generateSlots(config).length,
  });
}
