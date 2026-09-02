// Single source of truth for platform fees (ported from Maltivas, trimmed
// to CF's offerings). Values are decimal multipliers (0.05 = 5%) — the
// platform's cut; the creator receives the remainder.
//
// Partner giving (§9) is NOT here: gifts are phase 7, their fee policy is
// set by the concept note, and no giving codepath may reuse commerce fees
// by accident.

// The trickl column is CF's cut of each chunk, kept when CF forwards the
// chunk from its partner balance to the creator (lib/trickl-distribution).
// Trickl's own 2% is already gone before the money reaches CF.
export const PLATFORM_FEES = {
  // 2% — event ticket sales (organizers do the selling work)
  ticket: { stripe: 0.02, paystack: 0.02, trickl: 0.02 },

  // 5% — marketplace sales (creator delivers a good)
  product: { stripe: 0.05, paystack: 0.05, trickl: 0.05 },
  campaign: { stripe: 0.05, paystack: 0.05, trickl: 0.05 },
  ebook: { stripe: 0.05, paystack: 0.05, trickl: 0.05 },
  booking: { stripe: 0.05, paystack: 0.05, trickl: 0.05 },

  // 10% — catalog content with hosting attached
  course: { stripe: 0.1, paystack: 0.1, trickl: 0.1 },
  film: { stripe: 0.1, paystack: 0.1, trickl: 0.1 },
  premiere: { stripe: 0.1, paystack: 0.1, trickl: 0.1 },
} as const;

export type Offering = keyof typeof PLATFORM_FEES;
export type Provider = "stripe" | "paystack" | "trickl";

/** Platform's cut as a multiplier (e.g. 0.05). */
export const feeRate = (offering: Offering, provider: Provider): number =>
  PLATFORM_FEES[offering][provider];

/** Platform's cut as a whole-number percent (e.g. 5). */
export const feePercent = (offering: Offering, provider: Provider): number =>
  Math.round(feeRate(offering, provider) * 100);

/** Platform fee in the same units as `amount` (cents in → cents out). */
export const calcPlatformFee = (
  amount: number,
  offering: Offering,
  provider: Provider,
): number => Math.round(amount * feeRate(offering, provider));
