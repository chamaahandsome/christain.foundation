// Team access domain rules (PLAN §4, ported from Maltivas team-authorization).
// Pure functions, fully tested. Ministry staff manage a teacher's channel with
// per-feature access — a media volunteer can run the library without being
// able to touch the team or, later, money.

export const FEATURES = {
  /** Content & YouTube ingestion — everything under the channel's library. */
  LIBRARY: "library",
  /** Inviting/removing team members and editing their access. */
  TEAM: "team",
  /** Channel analytics (read-oriented; viewer is enough). */
  ANALYTICS: "analytics",
  /** Channel profile & settings. */
  SETTINGS: "settings",
} as const;

export type Feature = (typeof FEATURES)[keyof typeof FEATURES];

export const FEATURE_LIST: Feature[] = Object.values(FEATURES);

export const ACCESS_LEVELS = {
  NONE: "none",
  VIEWER: "viewer",
  MANAGER: "manager",
} as const;

export type AccessLevel = (typeof ACCESS_LEVELS)[keyof typeof ACCESS_LEVELS];

const LEVEL_RANK: Record<AccessLevel, number> = {
  none: 0,
  viewer: 1,
  manager: 2,
};

export type FeatureAccessMap = Partial<Record<Feature, AccessLevel>>;

/** Owners hold manager on everything; team rows never need this map stored. */
export const OWNER_ACCESS: FeatureAccessMap = Object.fromEntries(
  FEATURE_LIST.map((feature) => [feature, ACCESS_LEVELS.MANAGER]),
) as FeatureAccessMap;

/** Parse a stored JSON access map, dropping unknown features and levels. */
export function parseFeatureAccess(raw: unknown): FeatureAccessMap {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const known = new Set<string>(FEATURE_LIST);
  const levels = new Set<string>(Object.values(ACCESS_LEVELS));
  const map: FeatureAccessMap = {};
  for (const [key, value] of Object.entries(raw)) {
    if (known.has(key) && typeof value === "string" && levels.has(value)) {
      map[key as Feature] = value as AccessLevel;
    }
  }
  return map;
}

export function hasFeatureAccess(
  access: FeatureAccessMap,
  feature: Feature,
  minLevel: AccessLevel = ACCESS_LEVELS.VIEWER,
): boolean {
  const level = access[feature] ?? ACCESS_LEVELS.NONE;
  return LEVEL_RANK[level] >= LEVEL_RANK[minLevel];
}

export const INVITATION_TTL_DAYS = 7;

/** URL-safe invitation token (the accept link's credential). */
export function generateInviteToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function invitationExpiry(from: Date): Date {
  return new Date(from.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export interface AcceptCheck {
  ok: boolean;
  error?: string;
}

/** Whether a signed-in user may accept a pending invitation. The email must
 * match: invitation links are addressed, not bearer instruments — a forwarded
 * link must not hand channel access to whoever clicks it. */
export function canAcceptInvitation(input: {
  status: string;
  inviteExpiresAt: Date | null;
  invitedEmail: string;
  userEmail: string;
  now?: Date;
}): AcceptCheck {
  const now = input.now ?? new Date();
  if (input.status !== "PENDING") {
    return { ok: false, error: "This invitation is no longer open." };
  }
  if (!input.inviteExpiresAt || input.inviteExpiresAt.getTime() < now.getTime()) {
    return { ok: false, error: "This invitation has expired. Ask for a new one." };
  }
  if (input.invitedEmail.trim().toLowerCase() !== input.userEmail.trim().toLowerCase()) {
    return {
      ok: false,
      error: `This invitation was sent to ${input.invitedEmail}. Sign in with that email to accept it.`,
    };
  }
  return { ok: true };
}
