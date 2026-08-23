import { describe, expect, it } from "vitest";
import {
  PLATFORM_FEES,
  calcPlatformFee,
  feePercent,
  feeRate,
} from "@/lib/platform-fees";

describe("platform fees", () => {
  it("keeps the ported tiers: 2% tickets, 5% marketplace, 10% catalog", () => {
    expect(feeRate("ticket", "stripe")).toBe(0.02);
    expect(feeRate("ebook", "stripe")).toBe(0.05);
    expect(feeRate("film", "stripe")).toBe(0.1);
  });

  it("computes whole-number percents", () => {
    expect(feePercent("ebook", "stripe")).toBe(5);
    expect(feePercent("premiere", "paystack")).toBe(10);
  });

  it("computes fees in cents, rounded", () => {
    expect(calcPlatformFee(1000, "ebook", "stripe")).toBe(50);
    expect(calcPlatformFee(999, "ticket", "stripe")).toBe(20); // 19.98 → 20
    expect(calcPlatformFee(0, "course", "stripe")).toBe(0);
  });

  it("has no giving/gift offering — §9 fee policy is not commerce's to set", () => {
    expect(Object.keys(PLATFORM_FEES)).not.toContain("gift");
    expect(Object.keys(PLATFORM_FEES)).not.toContain("support");
  });
});
