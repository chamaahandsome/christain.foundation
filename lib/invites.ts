// Founding-cohort invite codes (lib/gate.ts: invited applications bypass the
// vouch minimum — there is no one to vouch yet). Pure rules here, tested;
// persistence lives in the routes.

/** Unambiguous alphabet: no 0/O, 1/I/L — codes get read aloud and retyped. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function normalizeInviteCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

/** CF-XXXX-XXXX from crypto-strength randomness. */
export function generateInviteCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return `CF-${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

export interface InviteCodeCheck {
  usable: boolean;
  reason?: string;
}

export function inviteCodeUsable(input: {
  revokedAt: Date | null;
  expiresAt: Date | null;
  maxUses: number;
  usageCount: number;
  now?: Date;
}): InviteCodeCheck {
  const now = input.now ?? new Date();
  if (input.revokedAt) {
    return { usable: false, reason: "This invitation code has been revoked." };
  }
  if (input.expiresAt && input.expiresAt.getTime() < now.getTime()) {
    return { usable: false, reason: "This invitation code has expired." };
  }
  if (input.usageCount >= input.maxUses) {
    return { usable: false, reason: "This invitation code has already been used." };
  }
  return { usable: true };
}
