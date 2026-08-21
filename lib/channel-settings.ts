// Channel profile rules (studio settings). Pure functions, fully tested.
// Links are a fixed-key record stored in Channel.links (Json) — a small,
// curated set, not a free-for-all link tree.

export const LINK_KEYS = [
  "website",
  "youtube",
  "instagram",
  "x",
  "facebook",
  "podcast",
] as const;

export type LinkKey = (typeof LINK_KEYS)[number];
export type ChannelLinks = Partial<Record<LinkKey, string>>;

export interface ProfileCheck {
  ok: boolean;
  errors: string[];
}

export function validateProfile(input: { name: string; bio: string }): ProfileCheck {
  const errors: string[] = [];
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) {
    errors.push("Channel name must be 2–80 characters.");
  }
  if (input.bio.length > 2000) {
    errors.push("Bio can be at most 2000 characters.");
  }
  return { ok: errors.length === 0, errors };
}

/** Normalize and validate links: known keys only, https URLs only, empties
 * dropped. Returns the cleaned record and per-key errors. */
export function validateLinks(input: Record<string, string>): {
  links: ChannelLinks;
  errors: string[];
} {
  const known = new Set<string>(LINK_KEYS);
  const links: ChannelLinks = {};
  const errors: string[] = [];

  for (const [key, raw] of Object.entries(input)) {
    if (!known.has(key)) continue; // unknown keys silently dropped
    const value = raw.trim();
    if (!value) continue;
    if (value.length > 300) {
      errors.push(`${key}: URL is too long.`);
      continue;
    }
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      errors.push(`${key}: not a valid URL (include https://).`);
      continue;
    }
    if (url.protocol !== "https:") {
      errors.push(`${key}: only https:// links are allowed.`);
      continue;
    }
    links[key as LinkKey] = url.toString();
  }

  return { links, errors };
}
