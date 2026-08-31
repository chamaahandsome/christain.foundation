// "A Cup of Cold Water" — small gifts to a creator (Matthew 10:41-42:
// receive a prophet, share the prophet's reward). Pure rules, tested.
//
// §9 constraints are structural, not stylistic:
// - The charge is a DIRECT charge on the creator's connected account —
//   the creator is merchant of record, never CF.
// - Non-deductibility is disclosed on every transaction (Mode B).
// - CF's platform fee on gifts is 5% via application_fee on the direct
//   charge (concept anticipates this; Maltivas charges the same on tips).
//   The disclosure states it plainly — change the rate HERE, nowhere else,
//   and keep the disclosure honest when you do.

export const CUP_PRESETS_CENTS = [300, 500, 1000, 2500] as const;
export const CUP_MIN_CENTS = 100; // $1
export const CUP_MAX_CENTS = 50_000; // $500 — beyond this, partner giving is the right tool
export const GIFT_FEE_RATE = 0.05; // 5% keeps the lights on

/** CF's platform fee for a gift, in cents. */
export function calcGiftFee(amountCents: number): number {
  return Math.round(amountCents * GIFT_FEE_RATE);
}

export const CUP_VERSE =
  "Whoever gives one of these little ones even a cup of cold water because he is a disciple, truly, I say to you, he will by no means lose his reward.";
export const CUP_VERSE_REF = "Matthew 10:42";

/** The Mode B disclosure, shown on the page and inside checkout. */
export function tipDisclosure(channelName: string): string {
  return `This is a personal gift to ${channelName}, who receives it directly. It is not tax-deductible. Christian Foundation keeps a 5% platform fee; the rest is ${channelName}'s.`;
}

export interface TipAmountCheck {
  ok: boolean;
  error?: string;
}

export function validateTipAmount(amountCents: number): TipAmountCheck {
  if (!Number.isInteger(amountCents)) {
    return { ok: false, error: "Amount must be a whole number of cents." };
  }
  if (amountCents < CUP_MIN_CENTS) {
    return { ok: false, error: "The smallest cup is $1." };
  }
  if (amountCents > CUP_MAX_CENTS) {
    return {
      ok: false,
      error: "For gifts above $500, partner giving (coming soon) is the right way.",
    };
  }
  return { ok: true };
}
