// YouTube channel ownership verification (pure rules, tested).
//
// Two proofs, same conclusion:
// - "google": the signed-in user's Google OAuth token (held by Clerk, with
//   the youtube.readonly scope) lists the channels that account owns —
//   `channels?mine=true`. A match is cryptographic proof.
// - "description": a one-time token pasted into the channel's description
//   on YouTube, read back via the Data API. Covers Brand Accounts and
//   non-Google sign-ins; the token can be removed once verified.

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateVerifyToken(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return `CF-VERIFY-${chars.join("")}`;
}

export const VERIFY_TOKEN_PATTERN = /^CF-VERIFY-[2-9A-HJKMNP-Z]{8}$/;

/** Case-insensitive containment — surrounding text is the creator's own;
 * the token itself survives verbatim. */
export function descriptionContainsToken(
  description: string,
  token: string,
): boolean {
  if (!VERIFY_TOKEN_PATTERN.test(token)) return false;
  return description.toUpperCase().includes(token.toUpperCase());
}

/** Parse `channels?mine=true` (OAuth) — the ids the Google account owns. */
export function parseMineChannelIds(json: unknown): string[] {
  const data = json as { items?: { id?: string }[] };
  return (data.items ?? [])
    .map((item) => item.id)
    .filter((id): id is string => Boolean(id));
}

/** The ownership decision, kept pure for tests. */
export function googleAccountOwnsChannel(
  ownedChannelIds: string[],
  linkedChannelId: string,
): boolean {
  return ownedChannelIds.includes(linkedChannelId);
}
