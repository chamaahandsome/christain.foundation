import { describe, expect, it } from "vitest";
import { MembershipStatus } from "@prisma/client";
import { membershipCurrent, validateTier } from "@/lib/membership";

describe("validateTier", () => {
  const base = {
    name: "Partner",
    description: "Monthly members-only teaching and early access.",
    priceCents: 500,
  };
  it("accepts a sound tier", () => {
    expect(validateTier(base)).toBeNull();
  });
  it("enforces name, description, and the price window", () => {
    expect(validateTier({ ...base, name: "x" })).toMatch(/name/);
    expect(validateTier({ ...base, description: "short" })).toMatch(/includes/);
    expect(validateTier({ ...base, priceCents: 100 })).toMatch(/between/);
    expect(validateTier({ ...base, priceCents: 200_000 })).toMatch(/between/);
  });
});

describe("membershipCurrent", () => {
  const now = new Date("2026-09-01T12:00:00Z");
  it("active with a future period end is current", () => {
    expect(
      membershipCurrent(
        { status: MembershipStatus.ACTIVE, currentPeriodEnd: new Date("2026-10-01") },
        now,
      ),
    ).toBe(true);
  });
  it("survives the dunning grace window, then lapses", () => {
    expect(
      membershipCurrent(
        {
          status: MembershipStatus.PAST_DUE,
          currentPeriodEnd: new Date("2026-08-30T12:00:00Z"),
        },
        now,
      ),
    ).toBe(true); // 2 days past — inside the 3-day grace
    expect(
      membershipCurrent(
        {
          status: MembershipStatus.PAST_DUE,
          currentPeriodEnd: new Date("2026-08-25T12:00:00Z"),
        },
        now,
      ),
    ).toBe(false);
  });
  it("cancelled never grants access", () => {
    expect(
      membershipCurrent(
        { status: MembershipStatus.CANCELLED, currentPeriodEnd: new Date("2026-10-01") },
        now,
      ),
    ).toBe(false);
  });
});
