import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { fulfillPledge, grantEbookPurchase, recordGift } from "@/lib/fulfillment";
import { calcGiftFee } from "@/lib/giving";
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

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (platformErr) {
    // Direct charges (gifts) arrive via the Connect endpoint, which signs
    // with its own secret.
    const connectSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
    if (!connectSecret) {
      console.error("stripe webhook verification failed", platformErr);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, connectSecret);
    } catch (err) {
      console.error("stripe webhook verification failed", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
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
    case "invoice.paid": {
      // Monthly cup of cold water: one gift per billing cycle. Metadata
      // rides the subscription and is snapshotted onto each invoice.
      const invoice = event.data.object;
      const meta = invoice.parent?.subscription_details?.metadata ?? {};
      if (
        meta.cfKind === "tip" &&
        meta.cfChannelId &&
        meta.cfUserId &&
        invoice.amount_paid > 0
      ) {
        await recordGift({
          channelId: meta.cfChannelId,
          userId: meta.cfUserId,
          amountCents: invoice.amount_paid,
          feeCents: calcGiftFee(invoice.amount_paid),
          provider: "stripe",
          providerRef: `${event.account ?? "acct"}_${invoice.id}`,
          note: meta.cfNote || undefined,
        });
      }
      break;
    }
    case "checkout.session.completed": {
      const session = event.data.object;
      const meta = session.metadata ?? {};
      // A cup of cold water (paragraph 9, Mode B): direct charge on the
      // creator's account — ledger the gift and tell the creator.
      if (
        meta.cfKind === "tip" &&
        meta.cfChannelId &&
        meta.cfUserId &&
        session.payment_status === "paid" &&
        // Monthly cups ledger per cycle via invoice.paid — never here, or
        // the first month would be recorded twice.
        session.mode !== "subscription"
      ) {
        await recordGift({
          channelId: meta.cfChannelId,
          userId: meta.cfUserId,
          amountCents: session.amount_total ?? 0,
          feeCents: calcGiftFee(session.amount_total ?? 0),
          provider: "stripe",
          providerRef: `${event.account ?? "acct"}_${
            typeof session.payment_intent === "string" ? session.payment_intent : session.id
          }`,
          note: meta.cfNote || undefined,
        });
        break;
      }
      if (meta.cfKind === "pledge" && meta.cfPledgeId && session.payment_status === "paid") {
        const shipping = session.collected_information?.shipping_details ?? null;
        await fulfillPledge({
          pledgeId: meta.cfPledgeId,
          provider: "stripe",
          providerRef: `${event.account ?? "platform"}_${
            typeof session.payment_intent === "string" ? session.payment_intent : session.id
          }`,
          feeCents: calcPlatformFee(session.amount_total ?? 0, "campaign", "stripe"),
          ...(shipping ? { shippingAddress: shipping } : {}),
        });
        break;
      }
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
