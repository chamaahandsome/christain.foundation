// Trickl partner distribution — CF's side of the pass-through.
//
// Trickl cannot pay creators onboarded on CF's Stripe platform (connected
// accounts are platform-scoped), so every chunk for a CF-registered provider
// is a destination charge into CF's OWN partner Stripe balance, net of
// Trickl's 2%. CF must then forward each chunk onward to the creator's
// connected account, keeping its platform fee — that forwarding is this
// module. One TricklChunk row per movement of money, keyed on Trickl's
// chunkId (stable across webhook redeliveries), so both forwarding and
// reversal are idempotent.

import { TricklChunkStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { calcGiftFee } from "@/lib/giving";
import { calcPlatformFee, type Offering } from "@/lib/platform-fees";
import { stripeClient } from "@/lib/stripe";

/** CF's cut of one chunk, by what the goal is paying for. */
export function chunkFeeCents(grossCents: number, cfKind: string): number {
  if (cfKind === "tip") return calcGiftFee(grossCents);
  const offering: Offering =
    cfKind === "ebook" ? "ebook" : cfKind === "pledge" ? "campaign" : "product";
  return calcPlatformFee(grossCents, offering, "trickl");
}

/** Record an incoming chunk and forward the creator's share from CF's
 * balance. Safe to call twice — the row upserts on chunkId and a chunk
 * that already forwarded (or reversed) is left alone. A failed transfer
 * (usually balance timing: the destination charge hasn't settled into
 * available funds yet) is marked FORWARD_FAILED for the cron to retry. */
export async function forwardTricklChunk(input: {
  chunkId: string;
  goalId: string;
  channelId: string;
  kind: string; // round_up | deposit | cycle
  cfKind: string; // tip | ebook | …
  grossCents: number;
}): Promise<void> {
  if (input.grossCents <= 0) return;
  const feeCents = chunkFeeCents(input.grossCents, input.cfKind);
  const netCents = input.grossCents - feeCents;

  let chunk;
  try {
    chunk = await db.tricklChunk.create({
      data: {
        chunkId: input.chunkId,
        goalId: input.goalId,
        channelId: input.channelId,
        kind: input.kind,
        cfKind: input.cfKind,
        grossCents: input.grossCents,
        feeCents,
        netCents,
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code !== "P2002") throw err;
    chunk = await db.tricklChunk.findUnique({ where: { chunkId: input.chunkId } });
    if (!chunk || chunk.status !== TricklChunkStatus.FORWARD_FAILED) return;
    // Redelivery of a chunk whose forward failed — fall through and retry.
  }

  await attemptForward(chunk.id);
}

/** Try (or retry) the onward transfer for one TricklChunk row. */
async function attemptForward(rowId: string): Promise<boolean> {
  const chunk = await db.tricklChunk.findUnique({ where: { id: rowId } });
  if (!chunk) return false;
  if (
    chunk.status === TricklChunkStatus.FORWARDED ||
    chunk.status === TricklChunkStatus.REVERSED
  ) {
    return true;
  }

  const stripe = stripeClient();
  const channel = await db.channel.findUnique({
    where: { id: chunk.channelId },
    select: { stripeAccountId: true, stripePayoutsEnabled: true },
  });

  const fail = async (reason: string) => {
    await db.tricklChunk.update({
      where: { id: chunk.id },
      data: { status: TricklChunkStatus.FORWARD_FAILED, lastError: reason.slice(0, 500) },
    });
    console.error(`trickl forward failed (${chunk.chunkId}): ${reason}`);
    return false;
  };

  if (!stripe) return fail("Stripe not configured");
  if (!channel?.stripeAccountId || !channel.stripePayoutsEnabled) {
    return fail("creator has no payable Stripe account");
  }

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: chunk.netCents,
        currency: "usd",
        destination: channel.stripeAccountId,
        transfer_group: `goal_${chunk.goalId}`,
        metadata: {
          cfTricklChunkId: chunk.chunkId,
          cfGoalId: chunk.goalId,
          cfKind: chunk.cfKind,
        },
      },
      // Stripe-side idempotency: a crashed process that retries can't
      // double-pay the creator for one chunk.
      { idempotencyKey: `trickl_fwd_${chunk.chunkId}` },
    );
    await db.tricklChunk.update({
      where: { id: chunk.id },
      data: {
        status: TricklChunkStatus.FORWARDED,
        transferId: transfer.id,
        lastError: null,
      },
    });
    return true;
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
}

/** Trickl clawed a chunk back (ACH return / dispute reversal). Unwind our
 * onward transfer if it was made; either way the chunk ends REVERSED so it
 * can never forward later. */
export async function reverseTricklChunk(chunkId: string): Promise<void> {
  const chunk = await db.tricklChunk.findUnique({ where: { chunkId } });
  if (!chunk || chunk.status === TricklChunkStatus.REVERSED) return;

  if (chunk.status === TricklChunkStatus.FORWARDED && chunk.transferId) {
    const stripe = stripeClient();
    if (!stripe) {
      // Exactly-once webhook: this delivery won't come again, so leave a
      // visible trace for ops instead of silently dropping the claw-back.
      await db.tricklChunk.update({
        where: { id: chunk.id },
        data: { lastError: "reversal received but Stripe unconfigured — reverse manually" },
      });
      console.error(`trickl reversal: Stripe unconfigured, chunk ${chunkId} needs manual reversal`);
      return;
    }
    try {
      await stripe.transfers.createReversal(
        chunk.transferId,
        {},
        { idempotencyKey: `trickl_rev_${chunk.chunkId}` },
      );
    } catch (err) {
      // Already-reversed transfers throw — treat as done; anything else is
      // recorded and left for the cron/ops to see.
      const msg = err instanceof Error ? err.message : String(err);
      if (!/already.*reversed/i.test(msg)) {
        await db.tricklChunk.update({
          where: { id: chunk.id },
          data: { lastError: `reversal failed: ${msg}`.slice(0, 500) },
        });
        console.error(`trickl reversal failed (${chunkId}): ${msg}`);
        return;
      }
    }
  }

  await db.tricklChunk.update({
    where: { id: chunk.id },
    data: { status: TricklChunkStatus.REVERSED },
  });
}

/** Cron entry point: retry every chunk whose forward failed (balance
 * timing resolves within a settlement day). Returns counts for the log. */
export async function retryFailedForwards(limit = 100): Promise<{
  retried: number;
  forwarded: number;
}> {
  const failed = await db.tricklChunk.findMany({
    where: { status: TricklChunkStatus.FORWARD_FAILED },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  let forwarded = 0;
  for (const row of failed) {
    if (await attemptForward(row.id)) forwarded += 1;
  }
  return { retried: failed.length, forwarded };
}
