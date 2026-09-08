import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SESSION_HOLD_MINUTES } from "@/lib/sessions";

export const dynamic = "force-dynamic";

// How long past its hold an unpaid 1:1 is left alone before being closed.
// The Stripe Checkout session expires exactly when the hold does, so no
// payment can land after that — the margin is only there so a webhook
// delivered late still finds its request open.
const ABANDONED_MARGIN_MS = 2 * 60 * 60 * 1000;

// Sweep expired slot holds so abandoned requests stop occupying the
// calendar. Confirmed bookings (status BOOKED) are never touched.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expired = await db.serviceBooking.findMany({
    where: { status: "HELD", holdExpiresAt: { lte: new Date() } },
    select: { id: true, serviceId: true },
  });
  if (expired.length > 0) {
    await db.serviceBooking.deleteMany({
      where: { id: { in: expired.map((r) => r.id) } },
    });
  }

  // An online 1:1 whose payment never arrived: the slot is already free
  // (the hold above is gone), so all that's left is closing the row so it
  // stops reading as "awaiting payment" in the creator's tab.
  const { count: abandoned } = await db.bookingRequest.updateMany({
    where: {
      kind: "ONLINE",
      status: "PENDING",
      paymentStatus: "pending",
      createdAt: {
        lte: new Date(Date.now() - SESSION_HOLD_MINUTES * 60_000 - ABANDONED_MARGIN_MS),
      },
    },
    data: { status: "CANCELLED", decisionNote: "Payment was never completed." },
  });

  return NextResponse.json({ ok: true, released: expired.length, abandoned });
}

export const POST = GET;
