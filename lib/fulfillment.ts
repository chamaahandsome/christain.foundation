// Purchase fulfillment — idempotent grants called from payment webhooks.
// Safe to run twice: the purchase upserts on (userId, ebookId) and the
// ledger row dedupes on providerRef.

import { NotificationType, TransactionStatus, TransactionType } from "@prisma/client";
import { db } from "@/lib/db";

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
