import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createOnboardingLink, ensureConnectAccount, stripeClient } from "@/lib/stripe";
import { getChannelAccess } from "@/lib/team-authorization";
import { IS_TRICKL_SANDBOX, registerTricklProvider, tricklConfigured } from "@/lib/trickl";

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
      tricklProviderLinkCode: true,
      tricklEnabledAt: true,
    },
  });

  return NextResponse.json({
    configured: Boolean(stripeClient()),
    connected: Boolean(channel.stripeAccountId),
    chargesEnabled: channel.stripeChargesEnabled,
    payoutsEnabled: channel.stripePayoutsEnabled,
    onboardedAt: channel.stripeOnboardedAt,
    trickl: {
      configured: tricklConfigured(),
      sandbox: IS_TRICKL_SANDBOX,
      enabled: Boolean(channel.tricklProviderLinkCode),
      enabledAt: channel.tricklEnabledAt,
    },
  });
}

const BodySchema = z.object({
  channelId: z.string().min(1),
  action: z.enum(["onboard", "enable_trickl"]),
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
  // ---- Trickl micro-payments: rides the Stripe Connect account ----
  if (parsed.data.action === "enable_trickl") {
    if (!tricklConfigured()) {
      return NextResponse.json(
        { error: "Trickl isn't configured on this environment yet." },
        { status: 503 },
      );
    }
    const channel = await db.channel.findUniqueOrThrow({
      where: { id: parsed.data.channelId },
      select: {
        id: true,
        name: true,
        handle: true,
        stripeAccountId: true,
        stripeChargesEnabled: true,
        tricklProviderLinkCode: true,
      },
    });
    if (channel.tricklProviderLinkCode) {
      return NextResponse.json({ enabled: true, already: true });
    }
    if (!channel.stripeAccountId || !channel.stripeChargesEnabled) {
      return NextResponse.json(
        { error: "Finish Stripe onboarding first — Trickl pays into your Stripe account." },
        { status: 409 },
      );
    }
    const clerkUser = await currentUser();
    const email = clerkUser?.emailAddresses?.[0]?.emailAddress;
    if (!email) {
      return NextResponse.json({ error: "No email on your account." }, { status: 400 });
    }
    try {
      const registration = await registerTricklProvider({
        stripeConnectAccountId: channel.stripeAccountId,
        externalCreatorId: channel.id,
        businessName: channel.name,
        email,
        websiteUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/@${channel.handle}` || undefined,
      });
      await db.channel.update({
        where: { id: channel.id },
        data: {
          tricklProviderLinkCode: registration.providerLinkCode,
          tricklWebhookSecret: registration.webhookSecret,
          tricklEnabledAt: new Date(),
        },
      });
      return NextResponse.json({ enabled: true });
    } catch (err) {
      console.error("trickl registration failed", err);
      return NextResponse.json(
        { error: "Could not register with Trickl. Try again shortly." },
        { status: 502 },
      );
    }
  }

  // ---- Stripe onboarding ----
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
