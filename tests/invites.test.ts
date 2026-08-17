import { describe, expect, it } from "vitest";
import {
  generateInviteCode,
  inviteCodeUsable,
  normalizeInviteCode,
} from "@/lib/invites";

describe("generateInviteCode", () => {
  it("produces CF-XXXX-XXXX codes from an unambiguous alphabet", () => {
    for (let i = 0; i < 20; i++) {
      const code = generateInviteCode();
      expect(code).toMatch(/^CF-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
      expect(code).not.toMatch(/[01OIL]/);
    }
  });

  it("does not repeat (sanity, not proof)", () => {
    const codes = new Set(Array.from({ length: 50 }, generateInviteCode));
    expect(codes.size).toBe(50);
  });
});

describe("normalizeInviteCode", () => {
  it("uppercases and strips whitespace", () => {
    expect(normalizeInviteCode("  cf-ab24-x9km ")).toBe("CF-AB24-X9KM");
    expect(normalizeInviteCode("CF - AB24 - X9KM")).toBe("CF-AB24-X9KM");
  });
});

describe("inviteCodeUsable", () => {
  const now = new Date("2026-08-16T12:00:00Z");
  const fresh = {
    revokedAt: null,
    expiresAt: null,
    maxUses: 1,
    usageCount: 0,
    now,
  };

  it("accepts a fresh code", () => {
    expect(inviteCodeUsable(fresh).usable).toBe(true);
  });

  it("rejects revoked codes", () => {
    const check = inviteCodeUsable({ ...fresh, revokedAt: new Date() });
    expect(check.usable).toBe(false);
    expect(check.reason).toMatch(/revoked/);
  });

  it("rejects expired codes", () => {
    expect(
      inviteCodeUsable({ ...fresh, expiresAt: new Date("2026-08-15T00:00:00Z") })
        .usable,
    ).toBe(false);
    expect(
      inviteCodeUsable({ ...fresh, expiresAt: new Date("2026-08-17T00:00:00Z") })
        .usable,
    ).toBe(true);
  });

  it("rejects exhausted codes but honors maxUses > 1", () => {
    expect(inviteCodeUsable({ ...fresh, usageCount: 1 }).usable).toBe(false);
    expect(
      inviteCodeUsable({ ...fresh, maxUses: 5, usageCount: 4 }).usable,
    ).toBe(true);
    expect(
      inviteCodeUsable({ ...fresh, maxUses: 5, usageCount: 5 }).usable,
    ).toBe(false);
  });
});
