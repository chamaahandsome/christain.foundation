import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { grantEbookPurchase } from "@/lib/fulfillment";
import { calcPlatformFee } from "@/lib/platform-fees";
import { stripeClient, syncAccountStatus } from "@/lib/stripe";

// Stripe webhook: signature-verified, exactly-once via
// ProcessedWebhookEvent. Phase 6 handles account lifecycle; payment events
// join as purchasables land.

export async function POST(req: Request) {
  const stripe = stripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, secret);
  } catch (err) {
    console.error("stripe webhook verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Exactly-once: claim the event id; a duplicate delivery is a no-op 200.
  try {
    await db.processedWebhookEvent.create({
      data: { id: event.id, provider: "stripe" },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    throw err;
  }

  switch (event.type) {
    case "account.updated":
      await syncAccountStatus(event.data.object);
      break;
    case "checkout.session.completed": {
      const session = event.data.object;
      const meta = session.metadata ?? {};
      if (
        meta.cfKind === "ebook" &&
        meta.cfEbookId &&
        meta.cfUserId &&
        meta.cfChannelId &&
        session.payment_status === "paid"
      ) {
        const amount = session.amount_total ?? 0;
        await grantEbookPurchase({
          ebookId: meta.cfEbookId,
          userId: meta.cfUserId,
          channelId: meta.cfChannelId,
          provider: "stripe",
          providerRef:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.id,
          amountCents: amount,
          feeCents: calcPlatformFee(amount, "ebook", "stripe"),
        });
      }
      break;
    }
    default:
      // Unhandled event types are acknowledged, not errors.
      break;
  }

  return NextResponse.json({ received: true });
}
