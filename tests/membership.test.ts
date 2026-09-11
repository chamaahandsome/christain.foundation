import { describe, expect, it } from "vitest";
import { MembershipStatus } from "@prisma/client";
import {
  membershipCurrent,
  planMembershipCycle,
  validateTier,
} from "@/lib/membership";

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

describe("planMembershipCycle", () => {
  const TIER = "tier_partner";
  const OTHER = "tier_patron";

  it("counts and announces a brand new member", () => {
    expect(planMembershipCycle({ prior: null, tierId: TIER })).toEqual({
      action: "create",
      increment: TIER,
      decrement: null,
      notify: true,
    });
  });

  it("restores a member who cancelled and came back", () => {
    // The regression this exists for: keying off the subscription id left
    // the old CANCELLED row untouched, so Stripe charged them every month
    // while isActiveMember stayed false.
    expect(
      planMembershipCycle({
        prior: { tierId: TIER, status: MembershipStatus.CANCELLED },
        tierId: TIER,
      }),
    ).toEqual({
      action: "rejoin",
      increment: TIER,
      decrement: null,
      notify: true,
    });
  });

  it("restores them even when they come back on a different tier", () => {
    expect(
      planMembershipCycle({
        prior: { tierId: OTHER, status: MembershipStatus.CANCELLED },
        tierId: TIER,
      }),
    ).toEqual({
      action: "rejoin",
      // Leaving already took them off the old tier — nothing to take down.
      increment: TIER,
      decrement: null,
      notify: true,
    });
  });

  it("moves the count when a current member switches tier", () => {
    expect(
      planMembershipCycle({
        prior: { tierId: OTHER, status: MembershipStatus.ACTIVE },
        tierId: TIER,
      }),
    ).toEqual({
      action: "switch-tier",
      increment: TIER,
      decrement: OTHER,
      notify: false,
    });
  });

  it("leaves a plain renewal alone", () => {
    for (const status of [MembershipStatus.ACTIVE, MembershipStatus.PAST_DUE]) {
      expect(planMembershipCycle({ prior: { tierId: TIER, status }, tierId: TIER })).toEqual({
        action: "renew",
        increment: null,
        decrement: null,
        notify: false,
      });
    }
  });

  it("never announces the same membership twice", () => {
    // A renewal must stay quiet, or the creator is told someone "became a
    // member" every month.
    const renewal = planMembershipCycle({
      prior: { tierId: TIER, status: MembershipStatus.ACTIVE },
      tierId: TIER,
    });
    expect(renewal.notify).toBe(false);
  });
});
