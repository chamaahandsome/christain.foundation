// Memberships (PLAN §7: Patreon-shaped commerce) — pure rules + the access
// check. A tier buys access: recurring subscription on the creator's
// connected account, CF's fee per cycle, MEMBERS content unlocked while
// ACTIVE. This is commerce, not giving — no Mode B machinery.

import { MembershipStatus } from "@prisma/client";
import { db } from "@/lib/db";

export const TIER_MIN_CENTS = 200; // $2/mo — below this, fees eat the tier
export const TIER_MAX_CENTS = 100_000; // $1k/mo sanity ceiling
// A failed renewal shouldn't lock a member out mid-dunning; Stripe retries
// for days. Access survives this long past the last paid period.
export const GRACE_DAYS = 3;

export function validateTier(input: {
  name: string;
  description: string;
  priceCents: number;
}): string | null {
  if (input.name.trim().length < 2) return "Give the tier a name.";
  if (input.description.trim().length < 10) {
    return "Tell members what this tier includes.";
  }
  if (
    !Number.isInteger(input.priceCents) ||
    input.priceCents < TIER_MIN_CENTS ||
    input.priceCents > TIER_MAX_CENTS
  ) {
    return `Tiers run between $${TIER_MIN_CENTS / 100} and $${TIER_MAX_CENTS / 100} per month.`;
  }
  return null;
}

/** Pure: is a membership row currently good for access? */
export function membershipCurrent(
  m: { status: MembershipStatus; currentPeriodEnd: Date | null },
  now: Date = new Date(),
): boolean {
  if (m.status === MembershipStatus.CANCELLED) return false;
  if (!m.currentPeriodEnd) return m.status === MembershipStatus.ACTIVE;
  return (
    m.currentPeriodEnd.getTime() + GRACE_DAYS * 86_400_000 > now.getTime()
  );
}

/** DB: does this user have member access to this channel right now? */
export async function isActiveMember(
  channelId: string,
  userId: string | null,
): Promise<boolean> {
  if (!userId) return false;
  const m = await db.channelMembership.findUnique({
    where: { channelId_userId: { channelId, userId } },
    select: { status: true, currentPeriodEnd: true },
  });
  return m ? membershipCurrent(m) : false;
}
