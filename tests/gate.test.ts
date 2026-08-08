import { describe, expect, it } from "vitest";
import { ApplicationStatus } from "@prisma/client";
import {
  affirmationComplete,
  applicationTransition,
  canSubmitApplication,
  canVouch,
  MIN_VOUCHES,
} from "@/lib/gate";

const CLAUSES = [
  "nicene-creed",
  "scripture-final-authority",
  "justification",
  "sole-mediator",
  "mary-and-the-saints",
];

describe("affirmationComplete", () => {
  it("is complete only when every clause is affirmed", () => {
    expect(affirmationComplete(CLAUSES, CLAUSES)).toEqual({
      complete: true,
      missing: [],
    });
  });

  it("lists exactly the missing clauses", () => {
    const result = affirmationComplete(CLAUSES, ["nicene-creed", "justification"]);
    expect(result.complete).toBe(false);
    expect(result.missing).toEqual([
      "scripture-final-authority",
      "sole-mediator",
      "mary-and-the-saints",
    ]);
  });

  it("ignores affirmations of unknown clauses", () => {
    const result = affirmationComplete(CLAUSES, [...CLAUSES, "extra-clause"]);
    expect(result.complete).toBe(true);
  });
});

describe("canSubmitApplication", () => {
  const complete = { complete: true, missing: [] };
  const incomplete = { complete: false, missing: ["justification"] };

  it("passes with full affirmation, conduct, and a vouch", () => {
    expect(
      canSubmitApplication({
        affirmation: complete,
        conductAgreed: true,
        vouchCount: MIN_VOUCHES,
        invited: false,
      }).ok,
    ).toBe(true);
  });

  it("fails without full affirmation — no partial signatures", () => {
    const check = canSubmitApplication({
      affirmation: incomplete,
      conductAgreed: true,
      vouchCount: 3,
      invited: false,
    });
    expect(check.ok).toBe(false);
    expect(check.errors[0]).toMatch(/justification/);
  });

  it("fails without conduct agreement", () => {
    const check = canSubmitApplication({
      affirmation: complete,
      conductAgreed: false,
      vouchCount: 1,
      invited: false,
    });
    expect(check.ok).toBe(false);
    expect(check.errors[0]).toMatch(/conduct/i);
  });

  it("requires a vouch unless invited (founding cohort)", () => {
    expect(
      canSubmitApplication({
        affirmation: complete,
        conductAgreed: true,
        vouchCount: 0,
        invited: false,
      }).ok,
    ).toBe(false);
    expect(
      canSubmitApplication({
        affirmation: complete,
        conductAgreed: true,
        vouchCount: 0,
        invited: true,
      }).ok,
    ).toBe(true);
  });

  it("collects all failures at once", () => {
    const check = canSubmitApplication({
      affirmation: incomplete,
      conductAgreed: false,
      vouchCount: 0,
      invited: false,
    });
    expect(check.errors).toHaveLength(3);
  });
});

describe("applicationTransition", () => {
  it("walks the happy path", () => {
    let status: ApplicationStatus = ApplicationStatus.DRAFT;
    status = applicationTransition(status, "submit");
    expect(status).toBe(ApplicationStatus.SUBMITTED);
    status = applicationTransition(status, "start_review");
    expect(status).toBe(ApplicationStatus.UNDER_REVIEW);
    expect(applicationTransition(status, "approve")).toBe(ApplicationStatus.APPROVED);
    expect(applicationTransition(status, "reject")).toBe(ApplicationStatus.REJECTED);
  });

  it("allows approve/reject directly from SUBMITTED", () => {
    expect(applicationTransition(ApplicationStatus.SUBMITTED, "approve")).toBe(
      ApplicationStatus.APPROVED,
    );
  });

  it("allows revision after rejection — rejections are not dead ends", () => {
    expect(applicationTransition(ApplicationStatus.REJECTED, "revise")).toBe(
      ApplicationStatus.DRAFT,
    );
  });

  it("rejects invalid transitions", () => {
    expect(() => applicationTransition(ApplicationStatus.DRAFT, "approve")).toThrow();
    expect(() => applicationTransition(ApplicationStatus.APPROVED, "reject")).toThrow();
    expect(() => applicationTransition(ApplicationStatus.APPROVED, "submit")).toThrow();
  });
});

describe("canVouch", () => {
  it("allows an approved creator to vouch for someone else", () => {
    expect(
      canVouch({
        voucherChannelStatus: "APPROVED",
        voucherOwnerId: "user-a",
        applicantUserId: "user-b",
      }).ok,
    ).toBe(true);
  });

  it("blocks unapproved channels", () => {
    expect(
      canVouch({
        voucherChannelStatus: "PENDING",
        voucherOwnerId: "user-a",
        applicantUserId: "user-b",
      }).ok,
    ).toBe(false);
  });

  it("blocks self-vouching", () => {
    const check = canVouch({
      voucherChannelStatus: "APPROVED",
      voucherOwnerId: "user-a",
      applicantUserId: "user-a",
    });
    expect(check.ok).toBe(false);
    expect(check.error).toMatch(/own application/);
  });
});
