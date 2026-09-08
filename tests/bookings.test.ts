import { describe, expect, it } from "vitest";
import {
  bookingTotalCents,
  parseServiceExtras,
  parseServiceImages,
} from "@/lib/bookings";

describe("parseServiceExtras", () => {
  it("keeps named rows, clamps prices, dedupes case-insensitively", () => {
    expect(
      parseServiceExtras([
        { name: "Livestream", priceCents: 15000 },
        { name: "livestream", priceCents: 999 }, // dupe
        { name: "  Q&A session  " },
        { name: "Negative", priceCents: -500 },
        { name: "" },
        "junk",
      ]),
    ).toEqual([
      { name: "Livestream", priceCents: 15000 },
      { name: "Q&A session", priceCents: null },
      { name: "Negative", priceCents: 0 },
    ]);
  });
  it("returns [] for non-arrays", () => {
    expect(parseServiceExtras(null)).toEqual([]);
    expect(parseServiceExtras({})).toEqual([]);
  });
});

describe("parseServiceImages", () => {
  it("keeps https urls only, max 3", () => {
    expect(
      parseServiceImages([
        "https://a.com/1.jpg",
        "http://insecure.com/2.jpg",
        42,
        "https://a.com/3.jpg",
        "https://a.com/4.jpg",
        "https://a.com/5.jpg",
      ]),
    ).toEqual(["https://a.com/1.jpg", "https://a.com/3.jpg", "https://a.com/4.jpg"]);
  });
});

describe("bookingTotalCents", () => {
  it("adds selected extras to the base rate", () => {
    expect(
      bookingTotalCents({
        rateCents: 50000,
        extras: [
          { name: "Livestream", priceCents: 15000 },
          { name: "Q&A", priceCents: null },
        ],
      }),
    ).toBe(65000);
  });
  it("rate on request → extras only, or null when there are none", () => {
    expect(bookingTotalCents({ rateCents: null, extras: [{ name: "A", priceCents: 2500 }] })).toBe(2500);
    expect(bookingTotalCents({ rateCents: null, extras: [] })).toBeNull();
  });
});
