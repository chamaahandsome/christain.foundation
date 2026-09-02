import { describe, expect, it } from "vitest";
import { chunkFeeCents } from "@/lib/trickl-distribution";

// CF's cut of each forwarded Trickl chunk. Trickl's own 2% is already gone
// before the money reaches CF's balance — these rates apply to what lands.

describe("chunkFeeCents", () => {
  it("takes the 5% gift fee on tip chunks", () => {
    expect(chunkFeeCents(300, "tip")).toBe(15);
    expect(chunkFeeCents(1000, "tip")).toBe(50);
  });

  it("takes the ebook rate on ebook chunks", () => {
    expect(chunkFeeCents(1000, "ebook")).toBe(50);
  });

  it("uses the campaign rate for pledges, product rate for unknown kinds", () => {
    expect(chunkFeeCents(1000, "pledge")).toBe(50);
    expect(chunkFeeCents(1000, "unknown")).toBe(50);
    expect(chunkFeeCents(1000, "")).toBe(50);
  });

  it("rounds per chunk, never negative net", () => {
    expect(chunkFeeCents(33, "tip")).toBe(2); // 1.65 → 2
    const gross = 101;
    const fee = chunkFeeCents(gross, "tip");
    expect(gross - fee).toBeGreaterThan(0);
  });
});
