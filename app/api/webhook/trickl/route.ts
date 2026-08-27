import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { grantEbookPurchase } from "@/lib/fulfillment";
import { verifyTricklSignature } from "@/lib/trickl";

// Trickl webhook: per-provider HMAC (X-Trickl-Signature over the raw body,
// secret issued at provider registration), exactly-once via
// ProcessedWebhookEvent. Phase 6 acknowledges and records; goal fulfillment
// (grant access, write Transaction rows) lands with the first purchasable.

interface TricklPayload {
  id?: string;
  type?: string;
  event?: string;
  data?: {
    providerLinkCode?: string;
    goalId?: string;
    amount?: number;
    metadata?: Record<string, string>;
  };
}

export async function POST(req: Request) {
  const signature = req.headers.get("x-trickl-signature");
  const webhookId = req.headers.get("x-trickl-webhook-id");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  let payload: TricklPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Resolve the provider whose secret signs this delivery: the payload's
  // providerLinkCode, or our channelId echoed back in goal metadata.
  const linkCode = payload.data?.providerLinkCode;
  const metaChannelId = payload.data?.metadata?.cfChannelId;
  const channel = linkCode
    ? await db.channel.findUnique({
        where: { tricklProviderLinkCode: linkCode },
        select: { id: true, tricklWebhookSecret: true },
      })
    : metaChannelId
      ? await db.channel.findUnique({
          where: { id: metaChannelId },
          select: { id: true, tricklWebhookSecret: true },
        })
      : null;
  if (!channel?.tricklWebhookSecret) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }
  if (!verifyTricklSignature(rawBody, signature, channel.tricklWebhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Exactly-once on the delivery id.
  const eventId = webhookId ?? payload.id;
  if (!eventId) {
    return NextResponse.json({ error: "Missing event id" }, { status: 400 });
  }
  try {
    await db.processedWebhookEvent.create({
      data: { id: `trickl_${eventId}`, provider: "trickl" },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    throw err;
  }

  const eventType = payload.type ?? payload.event ?? "unknown";
  switch (eventType) {
    case "goal.completed":
    case "payment.completed": {
      const meta = payload.data?.metadata ?? {};
      if (meta.cfKind === "ebook" && meta.cfEbookId && meta.cfUserId) {
        const ebook = await db.ebook.findUnique({
          where: { id: meta.cfEbookId },
          select: { priceCents: true },
        });
        await grantEbookPurchase({
          ebookId: meta.cfEbookId,
          userId: meta.cfUserId,
          channelId: meta.cfChannelId ?? channel.id,
          provider: "trickl",
          providerRef: `trickl_${payload.data?.goalId ?? eventId}`,
          amountCents: payload.data?.amount ?? ebook?.priceCents ?? 0,
          // Trickl pays the provider directly — CF takes no fee on the rail.
          feeCents: 0,
        });
      } else {
        console.log("trickl event acknowledged", eventType, payload.data?.goalId);
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
