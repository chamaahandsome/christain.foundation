// Stripe client + Connect helpers (commerce spine, PLAN §10 phase 6).
// Unlike the Maltivas original (throws at import), the client is lazy — the
// app boots without Stripe keys and payment surfaces degrade with a notice,
// matching the repo's no-keys convention for Clerk.
//
// Connect model: Express accounts + hosted onboarding links. Commerce uses
// destination-style charges with an application fee; partner giving (phase
// 7) will use DIRECT charges on the connected account — recipient as
// merchant of record, never CF (§9).

import Stripe from "stripe";
import { db } from "@/lib/db";

let client: Stripe | null = null;

export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client ??= new Stripe(key);
  return client;
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** Get or create the channel's Express account. Returns the account id. */
export async function ensureConnectAccount(channelId: string): Promise<string> {
  const stripe = stripeClient();
  if (!stripe) throw new Error("Stripe is not configured.");

  const channel = await db.channel.findUniqueOrThrow({
    where: { id: channelId },
    select: { id: true, handle: true, stripeAccountId: true },
  });
  if (channel.stripeAccountId) return channel.stripeAccountId;

  const account = await stripe.accounts.create({
    type: "express",
    metadata: { cfChannelId: channel.id, cfHandle: channel.handle },
  });
  await db.channel.update({
    where: { id: channel.id },
    data: { stripeAccountId: account.id },
  });
  return account.id;
}

/** Hosted onboarding (or resume) link back to the channel's payments tab. */
export async function createOnboardingLink(
  accountId: string,
  channelId: string,
): Promise<string> {
  const stripe = stripeClient();
  if (!stripe) throw new Error("Stripe is not configured.");

  const returnUrl = `${siteUrl()}/studio/channel/${channelId}/payments`;
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url: returnUrl,
    refresh_url: returnUrl,
  });
  return link.url;
}

/** Sync capability flags from a Stripe account object (webhook or fetch). */
export async function syncAccountStatus(account: Stripe.Account): Promise<void> {
  const channelId = account.metadata?.cfChannelId;
  const where = channelId ? { id: channelId } : { stripeAccountId: account.id };
  await db.channel
    .update({
      where,
      data: {
        stripeAccountId: account.id,
        stripeChargesEnabled: Boolean(account.charges_enabled),
        stripePayoutsEnabled: Boolean(account.payouts_enabled),
        ...(account.details_submitted ? { stripeOnboardedAt: new Date() } : {}),
      },
    })
    .catch(() => {
      // Account not linked to any channel (deleted channel, foreign event) —
      // nothing to sync.
    });
}
