import { describe, expect, it } from "vitest";
import crypto from "crypto";
import {
  TRICKL_MIN_TARGET_CENTS,
  checkTricklAmount,
  computeTricklDeadline,
  daysUntil,
  tricklMaxTargetCents,
  verifyTricklSignature,
} from "@/lib/trickl";

describe("tricklMaxTargetCents", () => {
  it("defaults to the 45-day window ($40)", () => {
    expect(tricklMaxTargetCents()).toBe(4000);
    expect(tricklMaxTargetCents(null)).toBe(4000);
  });

  it("scales with the window and clamps at 180 days ($160)", () => {
    expect(tricklMaxTargetCents(90)).toBe(8000);
    expect(tricklMaxTargetCents(180)).toBe(16000);
    expect(tricklMaxTargetCents(720)).toBe(16000);
  });
});

describe("checkTricklAmount", () => {
  it("rejects amounts below one $3 chunk", () => {
    expect(checkTricklAmount(299)).toMatch(/minimum/);
    expect(checkTricklAmount(TRICKL_MIN_TARGET_CENTS)).toBeNull();
  });

  it("caps the trickled portion, not the sticker price", () => {
    expect(checkTricklAmount(10000)).toMatch(/up to \$40/);
    // $100 with a $70 deposit → only $30 trickles — fine.
    expect(checkTricklAmount(10000, { depositCents: 7000 })).toBeNull();
    // Longer window raises the cap.
    expect(checkTricklAmount(10000, { daysAvailable: 180 })).toBeNull();
  });
});

describe("computeTricklDeadline", () => {
  const now = new Date("2026-08-16T12:00:00Z");

  it("sets the deadline 3 days before the event", () => {
    const deadline = computeTricklDeadline(new Date("2026-10-01T12:00:00Z"), now);
    expect(deadline).toBe("2026-09-28T12:00:00.000Z");
  });

  it("returns null when there is no time left to pay", () => {
    // Event 3 days out → buffered deadline is now → under the 24h floor.
    expect(computeTricklDeadline(new Date("2026-08-19T12:00:00Z"), now)).toBeNull();
    expect(computeTricklDeadline("not a date", now)).toBeNull();
  });

  it("daysUntil floors and never goes negative", () => {
    expect(daysUntil("2026-08-20T12:00:00Z", now)).toBe(4);
    expect(daysUntil("2026-08-10T12:00:00Z", now)).toBe(0);
    expect(daysUntil("garbage", now)).toBe(0);
  });
});

describe("verifyTricklSignature", () => {
  const secret = "whsec_test";
  const body = JSON.stringify({ id: "evt_1", type: "goal.completed" });
  const now = new Date("2026-09-01T12:00:00Z");
  const ts = String(Math.floor(now.getTime() / 1000));
  const good = crypto
    .createHmac("sha256", secret)
    .update(`${ts}.${body}`)
    .digest("hex");

  it("accepts the timestamp-bound HMAC and rejects everything else", () => {
    expect(verifyTricklSignature(body, good, secret, ts, now)).toBe(true);
    expect(verifyTricklSignature(body, good, "other-secret", ts, now)).toBe(false);
    expect(verifyTricklSignature(body + " ", good, secret, ts, now)).toBe(false);
    expect(verifyTricklSignature(body, "deadbeef", secret, ts, now)).toBe(false);
    expect(verifyTricklSignature(body, good, secret, String(Number(ts) - 1), now)).toBe(false);
  });

  it("rejects stale timestamps (replay window)", () => {
    const staleTs = String(Math.floor(now.getTime() / 1000) - 600);
    const staleSig = crypto
      .createHmac("sha256", secret)
      .update(`${staleTs}.${body}`)
      .digest("hex");
    expect(verifyTricklSignature(body, staleSig, secret, staleTs, now)).toBe(false);
    expect(verifyTricklSignature(body, good, secret, "garbage", now)).toBe(false);
  });
});
