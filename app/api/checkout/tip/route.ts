import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  GIFT_FEE_RATE,
  TIP_TRICKL_MAX_CENTS,
  TIP_TRICKL_MIN_CENTS,
  calcGiftFee,
  tipDisclosure,
  validateTipAmount,
} from "@/lib/giving";
import { stripeClient } from "@/lib/stripe";
import { createTricklGoal } from "@/lib/trickl";

// "A Cup of Cold Water" checkout (§9 Mode B): a DIRECT charge created ON
// the creator's connected account — they are the merchant of record, the
// money never touches CF. Non-deductibility is disclosed inside checkout.

const BodySchema = z.object({
  channelId: z.string().min(1),
  amountCents: z.number().int(),
  note: z.string().max(280).optional(),
  provider: z.enum(["stripe", "trickl"]).default("stripe"),
  // Monthly recurring cup — Stripe subscription or Trickl recurring goal.
  monthly: z.boolean().default(false),
});

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to send a cup." }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { channelId, amountCents, note, provider, monthly } = parsed.data;

  const check = validateTipAmount(amountCents);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 422 });
  }

  const channel = await db.channel.findUnique({
    where: { id: channelId },
    select: {
      id: true,
      name: true,
      handle: true,
      status: true,
      ownerId: true,
      stripeAccountId: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      tricklProviderLinkCode: true,
    },
  });
  if (!channel || channel.status !== "APPROVED") {
    return NextResponse.json({ error: "Channel not found." }, { status: 404 });
  }
  // §9.4: a channel that can't be paid out must not receive gifts.
  if (
    !channel.stripeAccountId ||
    !channel.stripeChargesEnabled ||
    !channel.stripePayoutsEnabled
  ) {
    return NextResponse.json(
      { error: "This creator isn't set up to receive gifts yet." },
      { status: 409 },
    );
  }
  if (channel.ownerId === userId) {
    return NextResponse.json(
      { error: "You can't send a cup to your own channel." },
      { status: 400 },
    );
  }

  const stripe = stripeClient();
  if (!stripe) {
    return NextResponse.json({ error: "Payments aren't configured yet." }, { status: 503 });
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

  const supportUrl = `${siteUrl()}/@${channel.handle}/support`;

  if (provider === "trickl") {
    if (!channel.tricklProviderLinkCode) {
      return NextResponse.json(
        { error: "This creator hasn't enabled Trickl yet." },
        { status: 409 },
      );
    }
    if (amountCents < TIP_TRICKL_MIN_CENTS || amountCents > TIP_TRICKL_MAX_CENTS) {
      return NextResponse.json(
        { error: "Trickl gifts work between $3 and $40." },
        { status: 422 },
      );
    }
    try {
      // Chunks pass straight through to the creator's Stripe account — CF is
      // never in the flow and takes no fee on this rail (amendment 2026-09-01).
      const goal = await createTricklGoal({
        providerLinkCode: channel.tricklProviderLinkCode,
        targetAmount: amountCents,
        description: monthly
          ? `A monthly cup of cold water for ${channel.name}`
          : `A cup of cold water for ${channel.name}`,
        metadata: {
          cfKind: "tip",
          cfChannelId: channel.id,
          cfUserId: userId,
          cfAmountCents: String(amountCents),
          ...(note ? { cfNote: note.slice(0, 280) } : {}),
        },
        callbackUrl: `${supportUrl}?trickl=started`,
        cancelUrl: supportUrl,
        ...(monthly ? { frequency: "MONTHLY" as const } : {}),
      });
      return NextResponse.json({ url: goal.paymentUrl });
    } catch (err) {
      console.error("trickl tip goal failed", err);
      return NextResponse.json(
        { error: "Could not start the Trickl gift. Try another method." },
        { status: 502 },
      );
    }
  }

  const tipMetadata = {
    cfKind: "tip",
    cfChannelId: channel.id,
    cfUserId: userId,
    ...(note ? { cfNote: note.slice(0, 280) } : {}),
  };

  try {
    // DIRECT charge (or subscription) created ON the connected account —
    // the creator stays merchant of record either way. Monthly cups bill
    // as a subscription; each cycle's invoice.paid ledgers its own gift.
    const session = monthly
      ? await stripe.checkout.sessions.create(
          {
            mode: "subscription",
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency: "usd",
                  unit_amount: amountCents,
                  recurring: { interval: "month" },
                  product_data: {
                    name: `A monthly cup of cold water for ${channel.name}`,
                  },
                },
              },
            ],
            subscription_data: {
              application_fee_percent: GIFT_FEE_RATE * 100,
              metadata: tipMetadata,
            },
            custom_text: {
              submit: { message: tipDisclosure(channel.name) },
            },
            metadata: tipMetadata,
            success_url: `${supportUrl}?thanks=1`,
            cancel_url: supportUrl,
          },
          { stripeAccount: channel.stripeAccountId },
        )
      : await stripe.checkout.sessions.create(
          {
            mode: "payment",
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency: "usd",
                  unit_amount: amountCents,
                  product_data: { name: `A cup of cold water for ${channel.name}` },
                },
              },
            ],
            payment_intent_data: {
              application_fee_amount: calcGiftFee(amountCents),
            },
            custom_text: {
              submit: { message: tipDisclosure(channel.name) },
            },
            metadata: tipMetadata,
            success_url: `${supportUrl}?thanks=1`,
            cancel_url: supportUrl,
          },
          { stripeAccount: channel.stripeAccountId },
        );
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("tip checkout failed", err);
    return NextResponse.json(
      { error: "Could not start the gift. Try again shortly." },
      { status: 502 },
    );
  }
}
