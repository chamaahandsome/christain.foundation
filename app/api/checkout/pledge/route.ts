import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  PLEDGE_TRICKL_MAX_CENTS,
  PLEDGE_TRICKL_MIN_CENTS,
  campaignOpen,
  pledgeDisclosure,
  rewardAvailable,
  validatePledgeAmount,
} from "@/lib/campaigns";
import { calcPlatformFee } from "@/lib/platform-fees";
import { stripeClient } from "@/lib/stripe";
import { createTricklGoal } from "@/lib/trickl";

// Pledge checkout — direct-support model, no funds held. MISSION pledges
// are §9 Mode B gifts: a DIRECT charge on the creator's connected account
// (creator is merchant of record) with CF's 5% as the application fee.
// CREATIVE pledges are commerce: a destination charge from the platform.
// Both disclose per transaction. Trickl (no reward, tip window) creates a
// micro-payment goal fulfilled by the Trickl webhook — both categories.

const BodySchema = z.object({
  campaignId: z.string().min(1),
  amountCents: z.number().int(),
  rewardId: z.string().optional(),
  provider: z.enum(["stripe", "trickl"]).default("stripe"),
  anonymous: z.boolean().default(false),
  message: z.string().max(500).optional(),
});

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to back this campaign." }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { campaignId, amountCents, rewardId, provider, anonymous, message } = parsed.data;

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    include: {
      channel: {
        select: {
          id: true,
          name: true,
          status: true,
          ownerId: true,
          stripeAccountId: true,
          stripeChargesEnabled: true,
          stripePayoutsEnabled: true,
          tricklProviderLinkCode: true,
        },
      },
      rewards: true,
    },
  });
  if (!campaign || campaign.channel.status !== "APPROVED") {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }
  if (!campaignOpen(campaign)) {
    return NextResponse.json({ error: "This campaign isn't taking pledges." }, { status: 409 });
  }
  // §9.4: a channel that can't be paid out can't take money.
  if (
    !campaign.channel.stripeAccountId ||
    !campaign.channel.stripeChargesEnabled ||
    !campaign.channel.stripePayoutsEnabled
  ) {
    return NextResponse.json(
      { error: "This creator isn't set up to receive pledges yet." },
      { status: 409 },
    );
  }
  if (campaign.channel.ownerId === userId) {
    return NextResponse.json(
      { error: "You can't back your own campaign." },
      { status: 400 },
    );
  }

  const reward = rewardId ? campaign.rewards.find((r) => r.id === rewardId) : null;
  if (rewardId && !reward) {
    return NextResponse.json({ error: "Reward not found." }, { status: 404 });
  }
  if (reward && !rewardAvailable(reward)) {
    return NextResponse.json({ error: "That reward is fully claimed." }, { status: 409 });
  }
  const amountError = validatePledgeAmount(amountCents, reward);
  if (amountError) {
    return NextResponse.json({ error: amountError }, { status: 422 });
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

  const campaignUrl = `${siteUrl()}/campaign/${campaign.slug}`;

  if (provider === "trickl") {
    // Founder decision 2026-09-01: Trickl runs on CREATIVE campaigns too.
    if (reward) {
      return NextResponse.json(
        { error: "Trickl pledges can't claim a reward — pledge directly instead." },
        { status: 409 },
      );
    }
    if (!campaign.channel.tricklProviderLinkCode) {
      return NextResponse.json(
        { error: "This creator hasn't enabled Trickl yet." },
        { status: 409 },
      );
    }
    if (amountCents < PLEDGE_TRICKL_MIN_CENTS || amountCents > PLEDGE_TRICKL_MAX_CENTS) {
      return NextResponse.json(
        { error: "Trickl pledges work between $3 and $40." },
        { status: 422 },
      );
    }
  }

  const pledge = await db.campaignPledge.create({
    data: {
      campaignId: campaign.id,
      rewardId: reward?.id ?? null,
      userId,
      amountCents,
      provider,
      anonymous,
      message: message?.trim() || null,
    },
  });

  const metadata = {
    cfKind: "pledge",
    cfPledgeId: pledge.id,
    cfCampaignId: campaign.id,
    cfChannelId: campaign.channel.id,
    cfUserId: userId,
    cfAmountCents: String(amountCents),
  };

  if (provider === "trickl") {
    try {
      const goal = await createTricklGoal({
        providerLinkCode: campaign.channel.tricklProviderLinkCode!,
        targetAmount: amountCents,
        description: `Pledge: ${campaign.title}`.slice(0, 500),
        metadata,
        callbackUrl: `${campaignUrl}?trickl=started`,
        cancelUrl: campaignUrl,
        ...(campaign.coverImageUrl ? { imageUrl: campaign.coverImageUrl } : {}),
      });
      return NextResponse.json({ url: goal.paymentUrl });
    } catch (err) {
      console.error("trickl pledge goal failed", err);
      return NextResponse.json(
        { error: "Could not start the Trickl pledge. Try another method." },
        { status: 502 },
      );
    }
  }

  const stripe = stripeClient();
  if (!stripe) {
    return NextResponse.json({ error: "Payments aren't configured yet." }, { status: 503 });
  }

  const fee = calcPlatformFee(amountCents, "campaign", "stripe");
  const lineItem = {
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: amountCents,
      product_data: {
        name: reward
          ? `${campaign.title} — ${reward.title}`
          : `Pledge to ${campaign.title}`,
        ...(campaign.coverImageUrl ? { images: [campaign.coverImageUrl] } : {}),
      },
    },
  };

  try {
    const session =
      campaign.category === "MISSION"
        ? // §9 Mode B gift: DIRECT charge on the creator's account.
          await stripe.checkout.sessions.create(
            {
              mode: "payment",
              line_items: [lineItem],
              payment_intent_data: { application_fee_amount: fee },
              custom_text: {
                submit: { message: pledgeDisclosure("MISSION", campaign.channel.name) },
              },
              metadata,
              success_url: `${campaignUrl}?thanks=1`,
              cancel_url: campaignUrl,
            },
            { stripeAccount: campaign.channel.stripeAccountId },
          )
        : // CREATIVE commerce: destination charge from the platform.
          await stripe.checkout.sessions.create({
            mode: "payment",
            line_items: [lineItem],
            payment_intent_data: {
              application_fee_amount: fee,
              transfer_data: { destination: campaign.channel.stripeAccountId },
            },
            custom_text: {
              submit: { message: pledgeDisclosure("CREATIVE", campaign.channel.name) },
            },
            metadata,
            success_url: `${campaignUrl}?thanks=1`,
            cancel_url: campaignUrl,
          });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("pledge checkout failed", err);
    return NextResponse.json(
      { error: "Could not start checkout. Try again shortly." },
      { status: 502 },
    );
  }
}
