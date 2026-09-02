import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fulfillPledge, grantEbookPurchase, recordGift } from "@/lib/fulfillment";
import { forwardTricklChunk, reverseTricklChunk } from "@/lib/trickl-distribution";
import { verifyTricklSignature } from "@/lib/trickl";
import { calcGiftFee } from "@/lib/giving";
import { calcPlatformFee } from "@/lib/platform-fees";

// Trickl webhook: per-provider HMAC-SHA256 over `${timestamp}.${rawBody}`
// (X-Trickl-Signature + X-Trickl-Timestamp, secret issued at provider
// registration, 5-minute replay window), exactly-once via
// ProcessedWebhookEvent. Amounts in Trickl webhook payloads are DOLLARS.
//
// Money flow: each chunk is a destination charge into CF's partner Stripe
// balance (net of Trickl's 2%); the per-chunk events below trigger CF's
// onward transfer to the creator, minus CF's fee (lib/trickl-distribution).

interface TricklPayload {
  id?: string;
  type?: string;
  event?: string;
  data?: {
    goalId?: string;
    amount?: number; // dollars
    targetAmount?: number; // dollars
    depositAmount?: number; // dollars
    cycleNumber?: number;
    chunkId?: string; // per-money-movement id (deposit/round-up/failure events)
    reversal?: boolean; // payment_failed only: money already settled was clawed back
    metadata?: Record<string, string>;
  };
}

function metaCents(meta: Record<string, string>, key: string): number | null {
  const n = Number(meta[key]);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export async function POST(req: Request) {
  const signature = req.headers.get("x-trickl-signature");
  const timestamp = req.headers.get("x-trickl-timestamp");
  const webhookId = req.headers.get("x-trickl-webhook-id");
  if (!signature || !timestamp) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  let payload: TricklPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Resolve the provider whose secret signs this delivery: our channelId is
  // echoed back verbatim in the goal metadata we set at creation.
  const meta = payload.data?.metadata ?? {};
  const metaChannelId = meta.cfChannelId;
  const channel = metaChannelId
    ? await db.channel.findUnique({
        where: { id: metaChannelId },
        select: { id: true, tricklWebhookSecret: true },
      })
    : null;
  if (!channel?.tricklWebhookSecret) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }
  if (!verifyTricklSignature(rawBody, signature, channel.tricklWebhookSecret, timestamp)) {
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
  const goalId = payload.data?.goalId ?? eventId;
  // Trickl reports dollars; our metadata carries the authoritative cents.
  const dollarsToCents = (d?: number) =>
    typeof d === "number" && Number.isFinite(d) ? Math.round(d * 100) : null;

  switch (eventType) {
    case "goal.completed":
    case "payment.completed": {
      if (meta.cfKind === "ebook" && meta.cfEbookId && meta.cfUserId) {
        const ebook = await db.ebook.findUnique({
          where: { id: meta.cfEbookId },
          select: { priceCents: true },
        });
        await grantEbookPurchase({
          ebookId: meta.cfEbookId,
          userId: meta.cfUserId,
          channelId: channel.id,
          provider: "trickl",
          providerRef: `trickl_${goalId}`,
          amountCents:
            metaCents(meta, "cfAmountCents") ??
            dollarsToCents(payload.data?.targetAmount) ??
            ebook?.priceCents ??
            0,
          // CF's cut is kept chunk-by-chunk as the money forwards
          // (lib/trickl-distribution); this mirrors it on the ledger row.
          feeCents: calcPlatformFee(
            metaCents(meta, "cfAmountCents") ??
              dollarsToCents(payload.data?.targetAmount) ??
              ebook?.priceCents ??
              0,
            "ebook",
            "trickl",
          ),
        });
      } else if (meta.cfKind === "tip" && meta.cfUserId) {
        const amountCents =
          metaCents(meta, "cfAmountCents") ??
          dollarsToCents(payload.data?.targetAmount) ??
          0;
        await recordGift({
          channelId: channel.id,
          userId: meta.cfUserId,
          amountCents,
          feeCents: calcGiftFee(amountCents),
          provider: "trickl",
          providerRef: `trickl_${goalId}`,
          note: meta.cfNote || undefined,
        });
      } else if (meta.cfKind === "pledge" && meta.cfPledgeId) {
        const amountCents =
          metaCents(meta, "cfAmountCents") ??
          dollarsToCents(payload.data?.targetAmount) ??
          0;
        await fulfillPledge({
          pledgeId: meta.cfPledgeId,
          provider: "trickl",
          providerRef: `trickl_${goalId}`,
          feeCents: calcPlatformFee(amountCents, "campaign", "trickl"),
        });
      } else {
        console.log("trickl event acknowledged", eventType, goalId);
      }
      break;
    }
    case "goal.deposit_paid":
    case "goal.round_up_collected": {
      // Money moved into CF's partner balance — forward the creator's share.
      const chunkId = payload.data?.chunkId;
      const grossCents =
        eventType === "goal.deposit_paid"
          ? (dollarsToCents(payload.data?.depositAmount) ??
            dollarsToCents(payload.data?.amount) ??
            0)
          : (dollarsToCents(payload.data?.amount) ?? 0);
      if (chunkId && grossCents > 0) {
        await forwardTricklChunk({
          chunkId,
          goalId,
          channelId: channel.id,
          kind: eventType === "goal.deposit_paid" ? "deposit" : "round_up",
          cfKind: meta.cfKind ?? "unknown",
          grossCents,
        });
      } else {
        console.log("trickl chunk event without chunkId/amount", eventType, goalId);
      }
      break;
    }
    case "goal.payment_failed": {
      // reversal=true means settled money was clawed back out of CF's
      // balance — unwind the onward transfer. reversal=false never moved
      // money; nothing to do.
      const chunkId = payload.data?.chunkId;
      if (payload.data?.reversal && chunkId) {
        await reverseTricklChunk(chunkId);
      }
      break;
    }
    case "goal.cycle_paid": {
      // Recurring cup of cold water: each paid cycle is its own gift.
      if (meta.cfKind === "tip" && meta.cfUserId) {
        const cycle = payload.data?.cycleNumber ?? 0;
        const amountCents =
          metaCents(meta, "cfAmountCents") ??
          dollarsToCents(payload.data?.amount) ??
          0;
        await recordGift({
          channelId: channel.id,
          userId: meta.cfUserId,
          amountCents,
          feeCents: calcGiftFee(amountCents),
          provider: "trickl",
          providerRef: `trickl_${goalId}_c${cycle}`,
          note: meta.cfNote || undefined,
        });
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
