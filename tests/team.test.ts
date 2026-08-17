import { describe, expect, it } from "vitest";
import {
  ACCESS_LEVELS,
  FEATURES,
  FEATURE_LIST,
  INVITATION_TTL_DAYS,
  OWNER_ACCESS,
  canAcceptInvitation,
  hasFeatureAccess,
  invitationExpiry,
  parseFeatureAccess,
} from "@/lib/team";

describe("parseFeatureAccess", () => {
  it("keeps known features with known levels", () => {
    expect(
      parseFeatureAccess({ library: "manager", team: "viewer" }),
    ).toEqual({ library: "manager", team: "viewer" });
  });

  it("drops unknown features and invalid levels", () => {
    expect(
      parseFeatureAccess({
        library: "manager",
        do_biz: "manager", // Maltivas feature not ported
        analytics: "admin", // not a level
        settings: 3,
      }),
    ).toEqual({ library: "manager" });
  });

  it("returns an empty map for non-object input", () => {
    expect(parseFeatureAccess(null)).toEqual({});
    expect(parseFeatureAccess("manager")).toEqual({});
    expect(parseFeatureAccess(["library"])).toEqual({});
  });
});

describe("hasFeatureAccess", () => {
  it("treats missing features as none", () => {
    expect(hasFeatureAccess({}, FEATURES.LIBRARY)).toBe(false);
  });

  it("orders none < viewer < manager", () => {
    const access = { library: ACCESS_LEVELS.VIEWER };
    expect(hasFeatureAccess(access, FEATURES.LIBRARY, ACCESS_LEVELS.VIEWER)).toBe(true);
    expect(hasFeatureAccess(access, FEATURES.LIBRARY, ACCESS_LEVELS.MANAGER)).toBe(false);
    expect(
      hasFeatureAccess({ library: ACCESS_LEVELS.MANAGER }, FEATURES.LIBRARY, ACCESS_LEVELS.VIEWER),
    ).toBe(true);
  });

  it("gives owners manager on every feature", () => {
    for (const feature of FEATURE_LIST) {
      expect(hasFeatureAccess(OWNER_ACCESS, feature, ACCESS_LEVELS.MANAGER)).toBe(true);
    }
  });
});

describe("canAcceptInvitation", () => {
  const now = new Date("2026-08-16T12:00:00Z");
  const valid = {
    status: "PENDING",
    inviteExpiresAt: new Date("2026-08-20T12:00:00Z"),
    invitedEmail: "staff@ministry.org",
    userEmail: "staff@ministry.org",
    now,
  };

  it("accepts a pending, unexpired, email-matching invitation", () => {
    expect(canAcceptInvitation(valid).ok).toBe(true);
  });

  it("matches emails case-insensitively", () => {
    expect(
      canAcceptInvitation({ ...valid, userEmail: "Staff@Ministry.ORG " }).ok,
    ).toBe(true);
  });

  it("rejects a forwarded link — email must match", () => {
    const check = canAcceptInvitation({ ...valid, userEmail: "other@example.com" });
    expect(check.ok).toBe(false);
    expect(check.error).toMatch(/staff@ministry\.org/);
  });

  it("rejects expired invitations", () => {
    expect(
      canAcceptInvitation({
        ...valid,
        inviteExpiresAt: new Date("2026-08-15T12:00:00Z"),
      }).ok,
    ).toBe(false);
    expect(canAcceptInvitation({ ...valid, inviteExpiresAt: null }).ok).toBe(false);
  });

  it("rejects non-pending invitations", () => {
    expect(canAcceptInvitation({ ...valid, status: "ACTIVE" }).ok).toBe(false);
    expect(canAcceptInvitation({ ...valid, status: "SUSPENDED" }).ok).toBe(false);
  });
});

describe("invitationExpiry", () => {
  it("adds the TTL to the given date", () => {
    const from = new Date("2026-08-16T00:00:00Z");
    const expiry = invitationExpiry(from);
    expect(expiry.getTime() - from.getTime()).toBe(
      INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
    );
  });
});
