import { describe, expect, it } from "vitest";
import {
  MAX_EBOOK_PRICE_CENTS,
  canReadChapter,
  nextChapterOrder,
  tricklEligibleForEbook,
  validateEbookInput,
} from "@/lib/ebooks";

describe("validateEbookInput", () => {
  it("accepts a normal paid book and a free book", () => {
    expect(validateEbookInput({ title: "Knowing God", priceCents: 900 }).ok).toBe(true);
    expect(validateEbookInput({ title: "Free Grace", priceCents: 0 }).ok).toBe(true);
  });

  it("rejects sub-dollar paid prices, negatives, and absurd prices", () => {
    expect(validateEbookInput({ title: "X2", priceCents: 50 }).ok).toBe(false);
    expect(validateEbookInput({ title: "X2", priceCents: -100 }).ok).toBe(false);
    expect(
      validateEbookInput({ title: "X2", priceCents: MAX_EBOOK_PRICE_CENTS + 1 }).ok,
    ).toBe(false);
    expect(validateEbookInput({ title: "X2", priceCents: 99.5 }).ok).toBe(false);
  });

  it("rejects bad titles", () => {
    expect(validateEbookInput({ title: " a ", priceCents: 0 }).ok).toBe(false);
  });
});

describe("canReadChapter", () => {
  const base = {
    published: true,
    priceCents: 900,
    freePreview: false,
    purchased: false,
    isStaff: false,
  };

  it("staff read everything, even unpublished", () => {
    expect(canReadChapter({ ...base, published: false, isStaff: true })).toBe(true);
  });

  it("unpublished books are staff-only", () => {
    expect(canReadChapter({ ...base, published: false, purchased: true })).toBe(false);
  });

  it("free books and free-preview chapters are open once published", () => {
    expect(canReadChapter({ ...base, priceCents: 0 })).toBe(true);
    expect(canReadChapter({ ...base, freePreview: true })).toBe(true);
  });

  it("paid chapters require the purchase", () => {
    expect(canReadChapter(base)).toBe(false);
    expect(canReadChapter({ ...base, purchased: true })).toBe(true);
  });
});

describe("tricklEligibleForEbook", () => {
  it("needs the channel enabled, a paid price, and the window rules", () => {
    expect(
      tricklEligibleForEbook({ priceCents: 900, channelTricklEnabled: true }),
    ).toBe(true);
    expect(
      tricklEligibleForEbook({ priceCents: 900, channelTricklEnabled: false }),
    ).toBe(false);
    expect(tricklEligibleForEbook({ priceCents: 0, channelTricklEnabled: true })).toBe(
      false,
    );
    // $250 exceeds the default 45-day window cap ($40) — not offerable.
    expect(
      tricklEligibleForEbook({ priceCents: 25_000, channelTricklEnabled: true }),
    ).toBe(false);
  });
});

describe("nextChapterOrder", () => {
  it("appends after the highest existing order", () => {
    expect(nextChapterOrder([])).toBe(1);
    expect(nextChapterOrder([1, 2, 3])).toBe(4);
    expect(nextChapterOrder([5, 2])).toBe(6);
  });
});
