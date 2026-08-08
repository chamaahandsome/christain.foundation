// Creator gate domain rules (concept §5). Pure functions, fully tested.
// The flow: affirm every clause of the current statement → agree to the
// conduct standard → gather vouches → submit → review → approve/reject.

import { ApplicationStatus } from "@prisma/client";

/** Minimum vouches from approved creators before an application can be submitted.
 * Launch-cohort applications are invited directly and reviewed without vouches
 * (there is no one to vouch yet) — the admin review handles that case. */
export const MIN_VOUCHES = 1;

export interface AffirmationCheck {
  complete: boolean;
  missing: string[]; // clause keys not yet affirmed
}

export function affirmationComplete(
  requiredClauseKeys: string[],
  affirmedClauseKeys: Iterable<string>,
): AffirmationCheck {
  const affirmed = new Set(affirmedClauseKeys);
  const missing = requiredClauseKeys.filter((key) => !affirmed.has(key));
  return { complete: missing.length === 0, missing };
}

export interface SubmissionCheck {
  ok: boolean;
  errors: string[];
}

export function canSubmitApplication(input: {
  affirmation: AffirmationCheck;
  conductAgreed: boolean;
  vouchCount: number;
  invited: boolean; // founding-cohort invitations bypass the vouch minimum
}): SubmissionCheck {
  const errors: string[] = [];
  if (!input.affirmation.complete) {
    errors.push(
      `The doctrinal statement must be affirmed in full (missing: ${input.affirmation.missing.join(", ")}).`,
    );
  }
  if (!input.conductAgreed) {
    errors.push("The conduct standard (§5.3) must be agreed to.");
  }
  if (!input.invited && input.vouchCount < MIN_VOUCHES) {
    errors.push(
      `At least ${MIN_VOUCHES} vouch from an approved creator is required.`,
    );
  }
  return { ok: errors.length === 0, errors };
}

// Application lifecycle: a plain state machine. Rejections return to DRAFT
// on revision rather than dead-ending — rejections are never arbitrary
// (§5.5) and reapplication is allowed.
export type ApplicationAction =
  | "submit"
  | "start_review"
  | "approve"
  | "reject"
  | "revise";

const TRANSITIONS: Record<ApplicationStatus, Partial<Record<ApplicationAction, ApplicationStatus>>> = {
  [ApplicationStatus.DRAFT]: { submit: ApplicationStatus.SUBMITTED },
  [ApplicationStatus.SUBMITTED]: {
    start_review: ApplicationStatus.UNDER_REVIEW,
    approve: ApplicationStatus.APPROVED,
    reject: ApplicationStatus.REJECTED,
  },
  [ApplicationStatus.UNDER_REVIEW]: {
    approve: ApplicationStatus.APPROVED,
    reject: ApplicationStatus.REJECTED,
  },
  [ApplicationStatus.APPROVED]: {},
  [ApplicationStatus.REJECTED]: { revise: ApplicationStatus.DRAFT },
};

export function applicationTransition(
  current: ApplicationStatus,
  action: ApplicationAction,
): ApplicationStatus {
  const next = TRANSITIONS[current]?.[action];
  if (!next) {
    throw new Error(`Cannot ${action} an application in status ${current}.`);
  }
  return next;
}

export interface VouchCheck {
  ok: boolean;
  error?: string;
}

export function canVouch(input: {
  voucherChannelStatus: string;
  voucherOwnerId: string;
  applicantUserId: string;
}): VouchCheck {
  if (input.voucherChannelStatus !== "APPROVED") {
    return { ok: false, error: "Only approved creators can vouch." };
  }
  if (input.voucherOwnerId === input.applicantUserId) {
    return { ok: false, error: "You cannot vouch for your own application." };
  }
  return { ok: true };
}
