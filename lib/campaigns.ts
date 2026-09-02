// Crowdfunding rules (concept §7b) — pure functions, tested. Direct-support
// model: every pledge is charged at payment time and routed straight to the
// creator; CF keeps its fee on the charge. MISSION pledges are §9 Mode B
// gifts (direct charge on the creator's account, non-deductibility disclosed
// per pledge); CREATIVE pledges are commerce (destination charge) backed by
// a stated deliverable + timeline.

export const CAMPAIGN_MIN_GOAL_CENTS = 10_000; // $100 — below this it's a tip
export const CAMPAIGN_MAX_GOAL_CENTS = 100_000_000; // $1M sanity ceiling
export const CAMPAIGN_MIN_DURATION_DAYS = 3;
export const CAMPAIGN_MAX_DURATION_DAYS = 90;
export const PLEDGE_MIN_CENTS = 100; // $1
export const PLEDGE_MAX_CENTS = 5_000_000; // $50k per pledge
// Trickl pledges follow the tip window. Both categories (founder decision
// 2026-09-01); reward-bearing pledges stay Stripe-only — a limited reward
// shouldn't be held by a goal that gathers over weeks and might cancel.
export const PLEDGE_TRICKL_MIN_CENTS = 300;
export const PLEDGE_TRICKL_MAX_CENTS = 4000;

/** Categories a creator can launch today; RESEARCH/NEED are gated off. */
export const LAUNCHABLE_CATEGORIES = ["MISSION", "CREATIVE"] as const;
export type LaunchableCategory = (typeof LAUNCHABLE_CATEGORIES)[number];

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function validateCampaignDraft(input: {
  title: string;
  category: string;
  shortDescription: string;
  goalCents: number;
  endsAt?: Date | null;
  deliverable?: string | null;
  now?: Date;
}): string | null {
  const now = input.now ?? new Date();
  if (input.title.trim().length < 4) return "Give the campaign a real title.";
  if (!LAUNCHABLE_CATEGORIES.includes(input.category as LaunchableCategory)) {
    return "Only Mission and Creative campaigns can be created right now.";
  }
  if (input.shortDescription.trim().length < 20) {
    return "Describe the campaign in at least a sentence.";
  }
  if (
    !Number.isInteger(input.goalCents) ||
    input.goalCents < CAMPAIGN_MIN_GOAL_CENTS ||
    input.goalCents > CAMPAIGN_MAX_GOAL_CENTS
  ) {
    return `The goal must be between $${CAMPAIGN_MIN_GOAL_CENTS / 100} and $${
      CAMPAIGN_MAX_GOAL_CENTS / 100
    }.`;
  }
  if (input.endsAt) {
    const days = (input.endsAt.getTime() - now.getTime()) / 86_400_000;
    if (days < CAMPAIGN_MIN_DURATION_DAYS || days > CAMPAIGN_MAX_DURATION_DAYS) {
      return `Campaigns run between ${CAMPAIGN_MIN_DURATION_DAYS} and ${CAMPAIGN_MAX_DURATION_DAYS} days.`;
    }
  }
  if (input.category === "CREATIVE" && !(input.deliverable ?? "").trim()) {
    return "Creative campaigns must state what backers are funding (the deliverable).";
  }
  return null;
}

/** A campaign is pledgeable while LIVE (or FUNDED — overfunding is fine)
 * and, when time-boxed, before the end date. */
export function campaignOpen(
  c: { status: string; endsAt: Date | null },
  now: Date = new Date(),
): boolean {
  if (c.status !== "LIVE" && c.status !== "FUNDED") return false;
  if (c.endsAt && c.endsAt.getTime() <= now.getTime()) return false;
  return true;
}

export function validatePledgeAmount(
  amountCents: number,
  reward?: { amountCents: number } | null,
): string | null {
  if (!Number.isInteger(amountCents) || amountCents < PLEDGE_MIN_CENTS) {
    return "The minimum pledge is $1.";
  }
  if (amountCents > PLEDGE_MAX_CENTS) {
    return "That's beyond the per-pledge maximum — reach out to us directly.";
  }
  if (reward && amountCents < reward.amountCents) {
    return `That reward needs a pledge of at least $${(reward.amountCents / 100).toFixed(2)}.`;
  }
  return null;
}

export function rewardAvailable(r: {
  active: boolean;
  maxBackers: number | null;
  backersCount: number;
}): boolean {
  if (!r.active) return false;
  if (r.maxBackers !== null && r.backersCount >= r.maxBackers) return false;
  return true;
}

export function progressPercent(raisedCents: number, goalCents: number): number {
  if (goalCents <= 0) return 0;
  return Math.min(100, Math.floor((raisedCents / goalCents) * 100));
}

export function daysLeft(endsAt: Date | null, now: Date = new Date()): number | null {
  if (!endsAt) return null;
  return Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 86_400_000));
}

/** §9 Mode B disclosure for MISSION pledges — per transaction, like tips. */
export function pledgeDisclosure(category: string, channelName: string): string {
  if (category === "MISSION") {
    return (
      `This is a personal gift supporting ${channelName}'s mission, received by them directly. ` +
      `It is not tax-deductible.`
    );
  }
  return (
    `You are backing ${channelName}'s stated deliverable. This is a purchase-style pledge, not a donation, ` +
    `and it is not tax-deductible.`
  );
}

/** Kickstarter-style reward liability line — shown on the campaign page
 * and appended in checkout when a reward is claimed. */
export function rewardDisclaimer(channelName: string): string {
  return (
    `Rewards are offered and fulfilled by ${channelName}, who is solely responsible for delivering them. ` +
    `Backing a campaign is support for the work, not a store purchase — rewards are not guaranteed, ` +
    `and Christian Foundation is not liable for undelivered or late rewards.`
  );
}

/** Countries Stripe Checkout may collect a shipping address for. */
export const SHIPPING_COUNTRIES = [
  "US", "CA", "GB", "IE", "AU", "NZ",
  "KE", "NG", "GH", "ZA", "UG", "TZ", "RW", "ET", "ZM", "MW", "BW",
  "DE", "FR", "NL", "SE", "NO", "DK", "FI", "ES", "IT", "PT", "AT", "BE", "CH", "PL",
  "BR", "MX", "IN", "PH", "SG", "KR", "JP",
] as const;
