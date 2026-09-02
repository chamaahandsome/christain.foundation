import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { NotificationType, TransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { stripeClient } from "@/lib/stripe";

// Creator-initiated pledge refund (ported from Maltivas' refund flow,
// trimmed to full refunds). Owner-only — money is never delegated.
//
// providerRef encodes the charge shape:
//   acct_…_pi_…    MISSION direct charge on the connected account —
//                  refund created ON that account, application fee returned
//   platform_pi_…  CREATIVE destination charge — refund on the platform
//                  with reverse_transfer + refund_application_fee
// Trickl pledges refund on the Trickl side (chunk reversals), not here.

const BodySchema = z.object({
  pledgeId: z.string().min(1),
  reason: z.string().max(500).optional(),
});

function parseProviderRef(ref: string): {
  paymentIntent: string;
  stripeAccount: string | null;
} | null {
  const pi = ref.indexOf("_pi_");
  if (ref.startsWith("acct_") && pi > 0) {
    return { stripeAccount: ref.slice(0, pi), paymentIntent: ref.slice(pi + 1) };
  }
  if (ref.startsWith("platform_")) {
    return { stripeAccount: null, paymentIntent: ref.slice("platform_".length) };
  }
  return null;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campaignId } = await params;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const pledge = await db.campaignPledge.findUnique({
    where: { id: parsed.data.pledgeId },
    include: {
      campaign: {
        select: { id: true, title: true, slug: true, channelId: true, channel: { select: { ownerId: true } } },
      },
    },
  });
  if (!pledge || pledge.campaignId !== campaignId) {
    return NextResponse.json({ error: "Pledge not found" }, { status: 404 });
  }
  if (pledge.campaign.channel.ownerId !== userId) {
    return NextResponse.json(
      { error: "Only the channel owner can issue refunds." },
      { status: 403 },
    );
  }
  if (pledge.status !== TransactionStatus.SUCCEEDED) {
    return NextResponse.json(
      { error: "Only completed pledges can be refunded." },
      { status: 409 },
    );
  }
  if (pledge.provider !== "stripe" || !pledge.providerRef) {
    return NextResponse.json(
      { error: "Trickl pledges refund through Trickl's chunk reversals, not here." },
      { status: 409 },
    );
  }
  const ref = parseProviderRef(pledge.providerRef);
  if (!ref) {
    return NextResponse.json(
      { error: "This pledge's payment reference can't be refunded automatically." },
      { status: 409 },
    );
  }

  const stripe = stripeClient();
  if (!stripe) {
    return NextResponse.json({ error: "Payments aren't configured." }, { status: 503 });
  }

  try {
    if (ref.stripeAccount) {
      // MISSION direct charge — refund on the connected account.
      await stripe.refunds.create(
        { payment_intent: ref.paymentIntent, refund_application_fee: true },
        { stripeAccount: ref.stripeAccount },
      );
    } else {
      // CREATIVE destination charge — unwind the transfer and the fee.
      await stripe.refunds.create({
        payment_intent: ref.paymentIntent,
        reverse_transfer: true,
        refund_application_fee: true,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // An already-refunded intent still needs our books settled below.
    if (!/already been refunded/i.test(msg)) {
      console.error("pledge refund failed", err);
      return NextResponse.json(
        { error: "Stripe refused the refund — check the payment in your dashboard." },
        { status: 502 },
      );
    }
  }

  // Settle our books: pledge, campaign counters, reward slot, ledger row.
  const { count } = await db.campaignPledge.updateMany({
    where: { id: pledge.id, status: TransactionStatus.SUCCEEDED },
    data: { status: TransactionStatus.REFUNDED },
  });
  if (count === 1) {
    await db.campaign.update({
      where: { id: pledge.campaign.id },
      data: {
        raisedCents: { decrement: pledge.amountCents },
        backersCount: { decrement: 1 },
      },
    });
    if (pledge.rewardId) {
      await db.campaignReward.updateMany({
        where: { id: pledge.rewardId, backersCount: { gt: 0 } },
        data: { backersCount: { decrement: 1 } },
      });
    }
    await db.transaction.updateMany({
      where: { providerRef: pledge.providerRef },
      data: { status: TransactionStatus.REFUNDED },
    });
    await db.notification.create({
      data: {
        userId: pledge.userId,
        type: NotificationType.SYSTEM,
        title: `Your pledge to “${pledge.campaign.title}” was refunded`,
        body: parsed.data.reason ?? "The creator refunded your pledge in full.",
        url: `/campaign/${pledge.campaign.slug}`,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
