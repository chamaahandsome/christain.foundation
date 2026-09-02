// Purchase fulfillment — idempotent grants called from payment webhooks.
// Safe to run twice: the purchase upserts on (userId, ebookId) and the
// ledger row dedupes on providerRef.

import { NotificationType, TransactionStatus, TransactionType } from "@prisma/client";
import { db } from "@/lib/db";

/** Ledger a cup of cold water and tell the creator. Idempotent on
 * providerRef; shared by the Stripe and Trickl webhooks. */
export async function recordGift(input: {
  channelId: string;
  userId: string;
  amountCents: number;
  feeCents: number;
  provider: "stripe" | "trickl";
  providerRef: string;
  note?: string;
}): Promise<void> {
  try {
    await db.transaction.create({
      data: {
        channelId: input.channelId,
        userId: input.userId,
        type: TransactionType.GIFT,
        status: TransactionStatus.SUCCEEDED,
        amountCents: input.amountCents,
        feeCents: input.feeCents,
        provider: input.provider,
        providerRef: input.providerRef,
        description: input.note ? `Cup of cold water: ${input.note}` : "Cup of cold water",
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return; // duplicate delivery
    throw err;
  }
  const [channel, supporter] = await Promise.all([
    db.channel.findUnique({
      where: { id: input.channelId },
      select: { ownerId: true },
    }),
    db.user.findUnique({ where: { id: input.userId }, select: { name: true } }),
  ]);
  if (!channel) return;
  const amount = (input.amountCents / 100).toFixed(2);
  await db.notification.create({
    data: {
      userId: channel.ownerId,
      type: NotificationType.SYSTEM,
      title: `💧 ${supporter?.name ?? "Someone"} sent a cup of cold water — $${amount}`,
      body: input.note ?? "He will by no means lose his reward. (Matt 10:42)",
      url: "/studio",
    },
  });
}

export async function grantEbookPurchase(input: {
  ebookId: string;
  userId: string;
  channelId: string;
  provider: "stripe" | "trickl";
  providerRef: string;
  amountCents: number;
  feeCents: number;
}): Promise<void> {
  const ebook = await db.ebook.findUnique({
    where: { id: input.ebookId },
    select: { id: true, title: true },
  });
  if (!ebook) {
    console.error("fulfillment: unknown ebook", input.ebookId);
    return;
  }

  try {
    await db.transaction.create({
      data: {
        channelId: input.channelId,
        userId: input.userId,
        type: TransactionType.PURCHASE,
        status: TransactionStatus.SUCCEEDED,
        amountCents: input.amountCents,
        feeCents: input.feeCents,
        provider: input.provider,
        providerRef: input.providerRef,
        description: `Ebook: ${ebook.title}`,
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code !== "P2002") throw err;
    // Ledger row already written by an earlier delivery — carry on.
  }

  const existing = await db.ebookPurchase.findUnique({
    where: { userId_ebookId: { userId: input.userId, ebookId: input.ebookId } },
    select: { id: true },
  });
  if (existing) return;

  await db.ebookPurchase.create({
    data: {
      ebookId: input.ebookId,
      userId: input.userId,
      provider: input.provider,
    },
  });
  await db.notification.create({
    data: {
      userId: input.userId,
      type: NotificationType.SYSTEM,
      title: `“${ebook.title}” is in your library`,
      body: "Thank you — your book is ready to read.",
      url: `/read/${ebook.id}`,
    },
  });
}

/** Complete a campaign pledge: flip it SUCCEEDED, move the campaign's
 * counters, ledger the Transaction, tell the creator. Idempotent — the
 * pledge row is the guard (only a PENDING pledge advances), and the ledger
 * row dedupes on providerRef. */
export async function fulfillPledge(input: {
  pledgeId: string;
  provider: "stripe" | "trickl";
  providerRef: string;
  feeCents: number;
  /** Stripe-collected mailing details for physical rewards. */
  shippingAddress?: unknown;
}): Promise<void> {
  const pledge = await db.campaignPledge.findUnique({
    where: { id: input.pledgeId },
    include: {
      campaign: {
        select: {
          id: true,
          title: true,
          slug: true,
          channelId: true,
          goalCents: true,
          raisedCents: true,
          status: true,
          channel: { select: { ownerId: true } },
        },
      },
    },
  });
  if (!pledge) {
    console.error("fulfillment: unknown pledge", input.pledgeId);
    return;
  }
  if (pledge.status !== TransactionStatus.PENDING) return; // already settled

  const { count } = await db.campaignPledge.updateMany({
    where: { id: pledge.id, status: TransactionStatus.PENDING },
    data: {
      status: TransactionStatus.SUCCEEDED,
      provider: input.provider,
      providerRef: input.providerRef,
      feeCents: input.feeCents,
      ...(input.shippingAddress
        ? { shippingAddress: input.shippingAddress as object }
        : {}),
    },
  });
  if (count === 0) return; // raced a concurrent delivery

  const newRaised = pledge.campaign.raisedCents + pledge.amountCents;
  await db.campaign.update({
    where: { id: pledge.campaign.id },
    data: {
      raisedCents: { increment: pledge.amountCents },
      backersCount: { increment: 1 },
      ...(newRaised >= pledge.campaign.goalCents && pledge.campaign.status === "LIVE"
        ? { status: "FUNDED" as const }
        : {}),
    },
  });
  if (pledge.rewardId) {
    // Atomic claim (the Maltivas pattern): the cap is re-validated at
    // increment time so concurrent fulfillments can't silently oversell.
    const claimed = await db.$executeRaw`
      UPDATE CampaignReward
      SET backersCount = backersCount + 1
      WHERE id = ${pledge.rewardId}
        AND (maxBackers IS NULL OR backersCount < maxBackers)`;
    if (claimed !== 1) {
      // The backer already paid for this tier — honor it and let the cap
      // overshoot by the race, loudly, rather than take money for nothing.
      await db.campaignReward.update({
        where: { id: pledge.rewardId },
        data: { backersCount: { increment: 1 } },
      });
      console.error(
        `fulfillment: reward ${pledge.rewardId} cap overshot by concurrent pledges — creator should honor or refund`,
      );
    }
  }

  try {
    await db.transaction.create({
      data: {
        channelId: pledge.campaign.channelId,
        userId: pledge.userId,
        type: TransactionType.PLEDGE,
        status: TransactionStatus.SUCCEEDED,
        amountCents: pledge.amountCents,
        feeCents: input.feeCents,
        provider: input.provider,
        providerRef: input.providerRef,
        description: `Pledge: ${pledge.campaign.title}`,
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code !== "P2002") throw err;
  }

  const supporter = pledge.anonymous
    ? null
    : await db.user.findUnique({ where: { id: pledge.userId }, select: { name: true } });
  await db.notification.create({
    data: {
      userId: pledge.campaign.channel.ownerId,
      type: NotificationType.SYSTEM,
      title: `🤝 ${supporter?.name ?? "Someone"} pledged $${(
        pledge.amountCents / 100
      ).toFixed(2)} to “${pledge.campaign.title}”`,
      body: pledge.message ?? null,
      url: `/campaign/${pledge.campaign.slug}`,
    },
  });
}
