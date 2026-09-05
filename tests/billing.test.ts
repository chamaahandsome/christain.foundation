import { describe, expect, it } from "vitest";
import {
  PAYMENT_TERMS,
  computeBillTotals,
  dueDateFor,
  parseLineItems,
} from "@/lib/billing";

describe("parseLineItems", () => {
  it("keeps valid rows, clamps numbers, drops empty and malformed rows", () => {
    const items = parseLineItems([
      { item: "Design", details: "Cover", qty: 2, rateCents: 5000 },
      { item: "", details: "", qty: 1, rateCents: 0 }, // empty → dropped
      { item: "Neg", details: "", qty: -3, rateCents: -100 }, // clamped
      "garbage",
      null,
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ item: "Design", details: "Cover", qty: 2, rateCents: 5000 });
    expect(items[1].qty).toBe(1);
    expect(items[1].rateCents).toBe(0);
  });
  it("returns [] for non-arrays", () => {
    expect(parseLineItems(null)).toEqual([]);
    expect(parseLineItems({})).toEqual([]);
  });
});

describe("computeBillTotals", () => {
  const items = [
    { item: "A", details: "", qty: 2, rateCents: 5000 }, // 100.00
    { item: "B", details: "", qty: 1, rateCents: 2500 }, // 25.00
  ];
  it("sums qty × rate, applies discount then tax on the discounted base", () => {
    const t = computeBillTotals({ lineItems: items, taxBps: 1000, discountCents: 2500 });
    expect(t.subtotalCents).toBe(12500);
    expect(t.discountCents).toBe(2500);
    expect(t.taxCents).toBe(1000); // 10% of 10000
    expect(t.totalCents).toBe(11000);
  });
  it("caps discount at the subtotal and never goes negative", () => {
    const t = computeBillTotals({ lineItems: items, discountCents: 99999 });
    expect(t.discountCents).toBe(12500);
    expect(t.totalCents).toBe(0);
  });
  it("zero items → zero everything", () => {
    expect(computeBillTotals({ lineItems: [] }).totalCents).toBe(0);
  });
});

describe("dueDateFor", () => {
  it("maps payment terms to day offsets", () => {
    const from = new Date("2026-09-04T00:00:00Z");
    expect(dueDateFor("due-on-receipt", from).getTime()).toBe(from.getTime());
    expect(dueDateFor("net-30", from).getTime()).toBe(from.getTime() + 30 * 86_400_000);
    expect(dueDateFor("unknown", from).getTime()).toBe(from.getTime());
    expect(Object.keys(PAYMENT_TERMS)).toContain("net-60");
  });
});
