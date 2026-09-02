import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_MIN_GOAL_CENTS,
  campaignOpen,
  daysLeft,
  pledgeDisclosure,
  progressPercent,
  rewardAvailable,
  slugify,
  validateCampaignDraft,
  validatePledgeAmount,
} from "@/lib/campaigns";

const now = new Date("2026-09-01T12:00:00Z");

describe("slugify", () => {
  it("makes URL-safe slugs", () => {
    expect(slugify("Bibles for Turkana — Phase 2!")).toBe("bibles-for-turkana-phase-2");
    expect(slugify("   ")).toBe("");
  });
});

describe("validateCampaignDraft", () => {
  const base = {
    title: "Bibles for Turkana",
    category: "MISSION",
    shortDescription: "A thousand Bibles for the churches of Turkana county.",
    goalCents: 500_000,
    now,
  };

  it("accepts a sound mission draft", () => {
    expect(validateCampaignDraft(base)).toBeNull();
  });

  it("rejects gated categories and tiny goals", () => {
    expect(validateCampaignDraft({ ...base, category: "NEED" })).toMatch(/Mission and Creative/);
    expect(
      validateCampaignDraft({ ...base, goalCents: CAMPAIGN_MIN_GOAL_CENTS - 1 }),
    ).toMatch(/goal/);
  });

  it("enforces the duration window", () => {
    expect(
      validateCampaignDraft({ ...base, endsAt: new Date("2026-09-02T12:00:00Z") }),
    ).toMatch(/between 3 and 90/);
    expect(
      validateCampaignDraft({ ...base, endsAt: new Date("2026-10-01T12:00:00Z") }),
    ).toBeNull();
  });

  it("requires a deliverable for CREATIVE", () => {
    expect(validateCampaignDraft({ ...base, category: "CREATIVE" })).toMatch(/deliverable/);
    expect(
      validateCampaignDraft({
        ...base,
        category: "CREATIVE",
        deliverable: "A feature-length documentary",
      }),
    ).toBeNull();
  });
});

describe("campaignOpen", () => {
  it("open while LIVE/FUNDED and before the end date", () => {
    expect(campaignOpen({ status: "LIVE", endsAt: null }, now)).toBe(true);
    expect(campaignOpen({ status: "FUNDED", endsAt: new Date("2026-10-01") }, now)).toBe(true);
    expect(campaignOpen({ status: "LIVE", endsAt: new Date("2026-08-01") }, now)).toBe(false);
    expect(campaignOpen({ status: "DRAFT", endsAt: null }, now)).toBe(false);
    expect(campaignOpen({ status: "CANCELLED", endsAt: null }, now)).toBe(false);
  });
});

describe("validatePledgeAmount", () => {
  it("enforces floor, ceiling, and reward minimum", () => {
    expect(validatePledgeAmount(99)).toMatch(/minimum/);
    expect(validatePledgeAmount(100)).toBeNull();
    expect(validatePledgeAmount(6_000_000)).toMatch(/maximum/);
    expect(validatePledgeAmount(1000, { amountCents: 2500 })).toMatch(/at least \$25/);
    expect(validatePledgeAmount(2500, { amountCents: 2500 })).toBeNull();
  });
});

describe("rewardAvailable", () => {
  it("respects active flag and backer limits", () => {
    expect(rewardAvailable({ active: true, maxBackers: null, backersCount: 99 })).toBe(true);
    expect(rewardAvailable({ active: true, maxBackers: 10, backersCount: 10 })).toBe(false);
    expect(rewardAvailable({ active: false, maxBackers: null, backersCount: 0 })).toBe(false);
  });
});

describe("progress + days", () => {
  it("progress caps at 100 and floors", () => {
    expect(progressPercent(0, 10_000)).toBe(0);
    expect(progressPercent(5_000, 10_000)).toBe(50);
    expect(progressPercent(25_000, 10_000)).toBe(100);
    expect(progressPercent(999, 100_000)).toBe(0);
  });

  it("daysLeft ceils and never goes negative", () => {
    expect(daysLeft(new Date("2026-09-03T13:00:00Z"), now)).toBe(3);
    expect(daysLeft(new Date("2026-08-01T12:00:00Z"), now)).toBe(0);
    expect(daysLeft(null, now)).toBeNull();
  });
});

describe("pledgeDisclosure", () => {
  it("MISSION reads as a Mode B gift, CREATIVE as commerce", () => {
    expect(pledgeDisclosure("MISSION", "Acme")).toMatch(/personal gift/);
    expect(pledgeDisclosure("MISSION", "Acme")).toMatch(/not tax-deductible/);
    expect(pledgeDisclosure("CREATIVE", "Acme")).toMatch(/deliverable/);
    expect(pledgeDisclosure("CREATIVE", "Acme")).toMatch(/not tax-deductible/);
  });
});
