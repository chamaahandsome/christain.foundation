import { describe, expect, it } from "vitest";
import { ReviewCaseStatus } from "@prisma/client";
import {
  MIN_CLAIM_LENGTH,
  caseTransition,
  decisionRequiresNote,
  isDecided,
  validateClaim,
} from "@/lib/doctrine";

describe("validateClaim", () => {
  it("rejects claims too short to cite anything", () => {
    const check = validateClaim("bad teaching");
    expect(check.ok).toBe(false);
    expect(check.error).toMatch(new RegExp(String(MIN_CLAIM_LENGTH)));
  });

  it("accepts a concrete claim", () => {
    expect(
      validateClaim(
        "At 14:32 the teacher states that Christ is a created being, contradicting the Nicene affirmation.",
      ).ok,
    ).toBe(true);
  });

  it("trims before measuring", () => {
    expect(validateClaim("   short   ").ok).toBe(false);
  });

  it("rejects claims over the maximum", () => {
    expect(validateClaim("x".repeat(5001)).ok).toBe(false);
  });
});

describe("caseTransition", () => {
  it("walks the review path", () => {
    let status: ReviewCaseStatus = ReviewCaseStatus.OPEN;
    status = caseTransition(status, "start_review");
    expect(status).toBe(ReviewCaseStatus.IN_REVIEW);
    expect(caseTransition(status, "uphold")).toBe(ReviewCaseStatus.UPHELD);
    expect(caseTransition(status, "dismiss")).toBe(ReviewCaseStatus.DISMISSED);
  });

  it("allows deciding directly from OPEN", () => {
    expect(caseTransition(ReviewCaseStatus.OPEN, "dismiss")).toBe(
      ReviewCaseStatus.DISMISSED,
    );
  });

  it("only an upheld case can be appealed — dismissal favors the channel", () => {
    expect(caseTransition(ReviewCaseStatus.UPHELD, "appeal")).toBe(
      ReviewCaseStatus.APPEALED,
    );
    expect(() => caseTransition(ReviewCaseStatus.DISMISSED, "appeal")).toThrow();
    expect(() => caseTransition(ReviewCaseStatus.OPEN, "appeal")).toThrow();
  });

  it("an appeal is resolved by deciding again", () => {
    expect(caseTransition(ReviewCaseStatus.APPEALED, "dismiss")).toBe(
      ReviewCaseStatus.DISMISSED,
    );
    expect(caseTransition(ReviewCaseStatus.APPEALED, "uphold")).toBe(
      ReviewCaseStatus.UPHELD,
    );
  });

  it("rejects invalid transitions", () => {
    expect(() => caseTransition(ReviewCaseStatus.UPHELD, "start_review")).toThrow();
    expect(() => caseTransition(ReviewCaseStatus.IN_REVIEW, "start_review")).toThrow();
  });
});

describe("decision metadata", () => {
  it("uphold/dismiss require a note; procedural actions don't", () => {
    expect(decisionRequiresNote("uphold")).toBe(true);
    expect(decisionRequiresNote("dismiss")).toBe(true);
    expect(decisionRequiresNote("start_review")).toBe(false);
    expect(decisionRequiresNote("appeal")).toBe(false);
  });

  it("isDecided covers exactly the terminal outcomes", () => {
    expect(isDecided(ReviewCaseStatus.UPHELD)).toBe(true);
    expect(isDecided(ReviewCaseStatus.DISMISSED)).toBe(true);
    expect(isDecided(ReviewCaseStatus.OPEN)).toBe(false);
    expect(isDecided(ReviewCaseStatus.APPEALED)).toBe(false);
  });
});
