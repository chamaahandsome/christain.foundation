import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { stripeClient } from "@/lib/stripe";

// Member self-serve cancel: the subscription runs to the end of the paid
// period, then Stripe's customer.subscription.deleted flips the row.

const BodySchema = z.object({ channelId: z.string().min(1) });

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const membership = await db.channelMembership.findUnique({
    where: { channelId_userId: { channelId: parsed.data.channelId, userId } },
    include: { channel: { select: { stripeAccountId: true } } },
  });
  if (!membership || membership.status === "CANCELLED") {
    return NextResponse.json({ error: "No active membership." }, { status: 404 });
  }
  const stripe = stripeClient();
  if (!stripe || !membership.channel.stripeAccountId) {
    return NextResponse.json({ error: "Payments aren't configured." }, { status: 503 });
  }

  try {
    await stripe.subscriptions.update(
      membership.stripeSubscriptionId,
      { cancel_at_period_end: true },
      { stripeAccount: membership.channel.stripeAccountId },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Already-cancelled subscriptions are fine — the webhook settles the row.
    if (!/No such subscription|canceled/i.test(msg)) {
      console.error("membership cancel failed", err);
      return NextResponse.json(
        { error: "Could not cancel — try again shortly." },
        { status: 502 },
      );
    }
  }
  return NextResponse.json({ ok: true, endsAt: membership.currentPeriodEnd });
}
