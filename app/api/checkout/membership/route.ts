import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { membershipCurrent } from "@/lib/membership";
import { feeRate } from "@/lib/platform-fees";
import { stripeClient } from "@/lib/stripe";

// Join a membership tier: a subscription created ON the creator's connected
// account (they are the merchant), CF's fee as application_fee_percent on
// every cycle — the monthly-cup rail, buying access instead of gifting.

const BodySchema = z.object({ tierId: z.string().min(1) });

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to become a member." }, { status: 401 });
  }
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const tier = await db.membershipTier.findUnique({
    where: { id: parsed.data.tierId },
    include: {
      channel: {
        select: {
          id: true,
          name: true,
          handle: true,
          status: true,
          ownerId: true,
          stripeAccountId: true,
          stripeChargesEnabled: true,
          stripePayoutsEnabled: true,
        },
      },
    },
  });
  if (!tier || !tier.active || tier.channel.status !== "APPROVED") {
    return NextResponse.json({ error: "Tier not found." }, { status: 404 });
  }
  // §9.4: no payouts, no revenue surfaces.
  if (
    !tier.channel.stripeAccountId ||
    !tier.channel.stripeChargesEnabled ||
    !tier.channel.stripePayoutsEnabled
  ) {
    return NextResponse.json(
      { error: "This creator isn't set up for memberships yet." },
      { status: 409 },
    );
  }
  if (tier.channel.ownerId === userId) {
    return NextResponse.json(
      { error: "You can't join your own channel." },
      { status: 400 },
    );
  }
  const existing = await db.channelMembership.findUnique({
    where: { channelId_userId: { channelId: tier.channel.id, userId } },
    select: { status: true, currentPeriodEnd: true },
  });
  if (existing && membershipCurrent(existing)) {
    return NextResponse.json(
      { error: "You're already a member of this channel." },
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

  const stripe = stripeClient();
  if (!stripe) {
    return NextResponse.json({ error: "Payments aren't configured yet." }, { status: 503 });
  }

  const supportUrl = `${siteUrl()}/@${tier.channel.handle}/support`;
  const metadata = {
    cfKind: "membership",
    cfTierId: tier.id,
    cfChannelId: tier.channel.id,
    cfUserId: userId,
  };

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: tier.priceCents,
              recurring: { interval: "month" },
              product_data: {
                name: `${tier.channel.name} membership — ${tier.name}`,
              },
            },
          },
        ],
        subscription_data: {
          application_fee_percent: feeRate("membership", "stripe") * 100,
          metadata,
        },
        metadata,
        success_url: `${supportUrl}?member=1`,
        cancel_url: supportUrl,
      },
      { stripeAccount: tier.channel.stripeAccountId },
    );
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("membership checkout failed", err);
    return NextResponse.json(
      { error: "Could not start checkout. Try again shortly." },
      { status: 502 },
    );
  }
}
