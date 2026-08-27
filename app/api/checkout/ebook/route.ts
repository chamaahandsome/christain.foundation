import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { tricklEligibleForEbook } from "@/lib/ebooks";
import { calcPlatformFee } from "@/lib/platform-fees";
import { stripeClient } from "@/lib/stripe";
import { createTricklGoal } from "@/lib/trickl";

// Ebook checkout: Stripe Checkout (destination charge + CF's 5% application
// fee) or a Trickl micro-payment goal (pays the creator's Stripe account in
// pass-through chunks). Free books grant instantly.

const BodySchema = z.object({
  ebookId: z.string().min(1),
  provider: z.enum(["stripe", "trickl"]).default("stripe"),
});

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Sign in to get this book." }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { ebookId, provider } = parsed.data;

  const ebook = await db.ebook.findUnique({
    where: { id: ebookId },
    include: {
      channel: {
        select: {
          id: true,
          status: true,
          stripeAccountId: true,
          stripeChargesEnabled: true,
          tricklProviderLinkCode: true,
        },
      },
    },
  });
  if (!ebook || !ebook.published || ebook.channel.status !== "APPROVED") {
    return NextResponse.json({ error: "Book not found." }, { status: 404 });
  }

  const existing = await db.ebookPurchase.findUnique({
    where: { userId_ebookId: { userId, ebookId } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ granted: true, already: true });
  }

  // Ensure the buyer's User row exists before anything references it.
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

  // Free book — grant on the spot, ledger row for the record.
  if (ebook.priceCents === 0) {
    await db.ebookPurchase.create({
      data: { ebookId, userId, provider: "free" },
    });
    return NextResponse.json({ granted: true });
  }

  if (!ebook.channel.stripeAccountId || !ebook.channel.stripeChargesEnabled) {
    return NextResponse.json(
      { error: "This creator isn't ready to sell yet." },
      { status: 409 },
    );
  }

  const bookUrl = `${siteUrl()}/book/${ebook.id}`;

  if (provider === "trickl") {
    if (
      !tricklEligibleForEbook({
        priceCents: ebook.priceCents,
        channelTricklEnabled: Boolean(ebook.channel.tricklProviderLinkCode),
      })
    ) {
      return NextResponse.json(
        { error: "Trickl isn't available for this book." },
        { status: 409 },
      );
    }
    try {
      const goal = await createTricklGoal({
        providerLinkCode: ebook.channel.tricklProviderLinkCode!,
        targetAmount: ebook.priceCents,
        description: `Ebook: ${ebook.title}`,
        metadata: {
          cfKind: "ebook",
          cfEbookId: ebook.id,
          cfUserId: userId,
          cfChannelId: ebook.channel.id,
        },
        callbackUrl: `${bookUrl}?trickl=started`,
        cancelUrl: bookUrl,
        ...(ebook.coverImageUrl ? { imageUrl: ebook.coverImageUrl } : {}),
      });
      return NextResponse.json({ url: goal.paymentUrl });
    } catch (err) {
      console.error("trickl goal creation failed", err);
      return NextResponse.json(
        { error: "Could not start the Trickl plan. Try another method." },
        { status: 502 },
      );
    }
  }

  const stripe = stripeClient();
  if (!stripe) {
    return NextResponse.json({ error: "Payments aren't configured yet." }, { status: 503 });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: ebook.currency,
            unit_amount: ebook.priceCents,
            product_data: {
              name: ebook.title,
              ...(ebook.coverImageUrl ? { images: [ebook.coverImageUrl] } : {}),
            },
          },
        },
      ],
      payment_intent_data: {
        application_fee_amount: calcPlatformFee(ebook.priceCents, "ebook", "stripe"),
        transfer_data: { destination: ebook.channel.stripeAccountId },
      },
      metadata: {
        cfKind: "ebook",
        cfEbookId: ebook.id,
        cfUserId: userId,
        cfChannelId: ebook.channel.id,
      },
      success_url: `${bookUrl}?purchased=1`,
      cancel_url: bookUrl,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("stripe checkout failed", err);
    return NextResponse.json(
      { error: "Could not start checkout. Try again shortly." },
      { status: 502 },
    );
  }
}
