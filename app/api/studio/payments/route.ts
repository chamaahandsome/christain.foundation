import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createOnboardingLink, ensureConnectAccount, stripeClient } from "@/lib/stripe";
import { getChannelAccess } from "@/lib/team-authorization";

// Stripe Connect onboarding — owner-only, like every money path (the
// Maltivas assertOwnership rule): delegated staff never touch payouts.

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const channelId = new URL(req.url).searchParams.get("channelId");
  if (!channelId) {
    return NextResponse.json({ error: "channelId is required" }, { status: 400 });
  }
  const access = await getChannelAccess(userId, channelId);
  if (!access.channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }
  if (!access.isOwner) {
    return NextResponse.json({ error: "Owner only." }, { status: 403 });
  }

  const channel = await db.channel.findUniqueOrThrow({
    where: { id: channelId },
    select: {
      stripeAccountId: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      stripeOnboardedAt: true,
    },
  });

  return NextResponse.json({
    configured: Boolean(stripeClient()),
    connected: Boolean(channel.stripeAccountId),
    chargesEnabled: channel.stripeChargesEnabled,
    payoutsEnabled: channel.stripePayoutsEnabled,
    onboardedAt: channel.stripeOnboardedAt,
  });
}

const BodySchema = z.object({
  channelId: z.string().min(1),
  action: z.literal("onboard"),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const access = await getChannelAccess(userId, parsed.data.channelId);
  if (!access.channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }
  if (!access.isOwner) {
    return NextResponse.json({ error: "Owner only." }, { status: 403 });
  }
  if (access.channel.status !== "APPROVED") {
    return NextResponse.json(
      { error: "Payments open once the channel is approved." },
      { status: 409 },
    );
  }
  if (!stripeClient()) {
    return NextResponse.json(
      { error: "Payments aren't configured on this environment yet." },
      { status: 503 },
    );
  }

  try {
    const accountId = await ensureConnectAccount(parsed.data.channelId);
    const url = await createOnboardingLink(accountId, parsed.data.channelId);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("stripe onboarding failed", err);
    return NextResponse.json(
      { error: "Could not start Stripe onboarding. Try again shortly." },
      { status: 502 },
    );
  }
}
