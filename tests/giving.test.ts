import { describe, expect, it } from "vitest";
import {
  CUP_MAX_CENTS,
  CUP_MIN_CENTS,
  CUP_PRESETS_CENTS,
  GIFT_FEE_RATE,
  calcGiftFee,
  tipDisclosure,
  validateTipAmount,
} from "@/lib/giving";

describe("cup of cold water amounts", () => {
  it("accepts presets and sane customs", () => {
    for (const preset of CUP_PRESETS_CENTS) {
      expect(validateTipAmount(preset).ok).toBe(true);
    }
    expect(validateTipAmount(CUP_MIN_CENTS).ok).toBe(true);
    expect(validateTipAmount(CUP_MAX_CENTS).ok).toBe(true);
  });

  it("rejects sub-dollar, oversized, and fractional amounts", () => {
    expect(validateTipAmount(99).ok).toBe(false);
    expect(validateTipAmount(CUP_MAX_CENTS + 1).ok).toBe(false);
    expect(validateTipAmount(500.5).ok).toBe(false);
    expect(validateTipAmount(-500).ok).toBe(false);
  });

  it("oversized gifts point to partner giving", () => {
    expect(validateTipAmount(100_000).error).toMatch(/partner giving/i);
  });
});

describe("§9 posture", () => {
  it("CF keeps 5% via application fee — rounded to the cent", () => {
    expect(GIFT_FEE_RATE).toBe(0.05);
    expect(calcGiftFee(500)).toBe(25);
    expect(calcGiftFee(999)).toBe(50);
    expect(calcGiftFee(100)).toBe(5);
  });

  it("the disclosure names the recipient, denies deductibility, and states the fee", () => {
    const text = tipDisclosure("Grace Chapel");
    expect(text).toContain("Grace Chapel");
    expect(text).toMatch(/not tax-deductible/);
    expect(text).toMatch(/5% platform fee/);
    expect(text).toMatch(/receives it directly/);
  });
});
