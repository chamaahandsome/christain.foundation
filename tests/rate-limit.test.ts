import { describe, expect, it, beforeEach } from "vitest";
import { allowGuestRequest, rateLimit, resetRateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => resetRateLimit());

  it("allows up to the limit, then refuses", () => {
    const opts = { limit: 3, windowMs: 1000, now: 0 };
    expect(rateLimit("b", "ip", opts).allowed).toBe(true);
    expect(rateLimit("b", "ip", opts).allowed).toBe(true);
    expect(rateLimit("b", "ip", opts).allowed).toBe(true);
    expect(rateLimit("b", "ip", opts).allowed).toBe(false);
  });

  it("counts down what's left", () => {
    const opts = { limit: 2, windowMs: 1000, now: 0 };
    expect(rateLimit("b", "ip", opts).remaining).toBe(1);
    expect(rateLimit("b", "ip", opts).remaining).toBe(0);
    expect(rateLimit("b", "ip", opts).remaining).toBe(0);
  });

  it("opens again once the window passes", () => {
    const opts = { limit: 1, windowMs: 1000 };
    expect(rateLimit("b", "ip", { ...opts, now: 0 }).allowed).toBe(true);
    expect(rateLimit("b", "ip", { ...opts, now: 500 }).allowed).toBe(false);
    expect(rateLimit("b", "ip", { ...opts, now: 1001 }).allowed).toBe(true);
  });

  it("keeps callers and buckets apart", () => {
    const opts = { limit: 1, windowMs: 1000, now: 0 };
    expect(rateLimit("b", "a", opts).allowed).toBe(true);
    expect(rateLimit("b", "a", opts).allowed).toBe(false);
    // A different IP is untouched by the first one's spending.
    expect(rateLimit("b", "z", opts).allowed).toBe(true);
    // So is the same IP in a different bucket.
    expect(rateLimit("other", "a", opts).allowed).toBe(true);
  });
});

describe("allowGuestRequest", () => {
  beforeEach(() => resetRateLimit());

  it("gives a guest three requests in five minutes", () => {
    expect(allowGuestRequest("1.2.3.4", 0)).toBe(true);
    expect(allowGuestRequest("1.2.3.4", 1000)).toBe(true);
    expect(allowGuestRequest("1.2.3.4", 2000)).toBe(true);
    expect(allowGuestRequest("1.2.3.4", 3000)).toBe(false);
    // Five minutes on, they're welcome again.
    expect(allowGuestRequest("1.2.3.4", 300_001)).toBe(true);
  });

  it("lets a request through when the IP is unknown", () => {
    // No header to key on: better to allow than to lump every anonymous
    // visitor behind one counter.
    for (let i = 0; i < 10; i += 1) {
      expect(allowGuestRequest(null, i)).toBe(true);
    }
  });
});
