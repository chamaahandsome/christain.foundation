// Standing-audit domain rules (concept §5.4). Pure functions, fully tested.
// The signature is the gate; the body of work is the audit: review runs on
// *published teaching*, never on paperwork or private belief. Distinct from
// safety moderation — this queue answers one question: was the affirmed
// standard violated in the cited teaching?

import { ReviewCaseStatus } from "@prisma/client";

/** A claim must cite the teaching concretely — not "I don't like him". */
export const MIN_CLAIM_LENGTH = 30;
export const MAX_CLAIM_LENGTH = 5000;

export interface ClaimCheck {
  ok: boolean;
  error?: string;
}

export function validateClaim(claim: string): ClaimCheck {
  const trimmed = claim.trim();
  if (trimmed.length < MIN_CLAIM_LENGTH) {
    return {
      ok: false,
      error: `A claim must cite the teaching concretely (at least ${MIN_CLAIM_LENGTH} characters).`,
    };
  }
  if (trimmed.length > MAX_CLAIM_LENGTH) {
    return { ok: false, error: `A claim can be at most ${MAX_CLAIM_LENGTH} characters.` };
  }
  return { ok: true };
}

// Case lifecycle. Appeal belongs to the accused: only an UPHELD case can be
// appealed (a dismissal already favors the channel), and an appeal reopens
// the decision, not the case history.
export type CaseAction =
  | "start_review"
  | "uphold"
  | "dismiss"
  | "appeal";

const TRANSITIONS: Record<ReviewCaseStatus, Partial<Record<CaseAction, ReviewCaseStatus>>> = {
  [ReviewCaseStatus.OPEN]: {
    start_review: ReviewCaseStatus.IN_REVIEW,
    uphold: ReviewCaseStatus.UPHELD,
    dismiss: ReviewCaseStatus.DISMISSED,
  },
  [ReviewCaseStatus.IN_REVIEW]: {
    uphold: ReviewCaseStatus.UPHELD,
    dismiss: ReviewCaseStatus.DISMISSED,
  },
  [ReviewCaseStatus.UPHELD]: { appeal: ReviewCaseStatus.APPEALED },
  [ReviewCaseStatus.DISMISSED]: {},
  [ReviewCaseStatus.APPEALED]: {
    uphold: ReviewCaseStatus.UPHELD,
    dismiss: ReviewCaseStatus.DISMISSED,
  },
};

export function caseTransition(
  current: ReviewCaseStatus,
  action: CaseAction,
): ReviewCaseStatus {
  const next = TRANSITIONS[current]?.[action];
  if (!next) {
    throw new Error(`Cannot ${action} a case in status ${current}.`);
  }
  return next;
}

/** Decisions are never noteless — outcomes carry reasons (§5.5 spirit:
 * nothing here is arbitrary). */
export function decisionRequiresNote(action: CaseAction): boolean {
  return action === "uphold" || action === "dismiss";
}

export function isDecided(status: ReviewCaseStatus): boolean {
  return status === ReviewCaseStatus.UPHELD || status === ReviewCaseStatus.DISMISSED;
}
