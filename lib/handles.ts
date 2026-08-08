// Channel handle rules: /@handle is a public identity, so the rules are
// strict — lowercase, 3–30 chars, alphanumeric with dots/underscores, no
// leading/trailing/consecutive separators, and no reserved words.

const RESERVED = new Set([
  "admin",
  "api",
  "app",
  "cf",
  "channel",
  "channels",
  "christianfoundation",
  "explore",
  "give",
  "giving",
  "help",
  "map",
  "official",
  "onboarding",
  "pathway",
  "pathways",
  "search",
  "settings",
  "shop",
  "signin",
  "signup",
  "start-here",
  "starthere",
  "support",
  "team",
  "watch",
]);

const HANDLE_PATTERN = /^[a-z0-9](?:[a-z0-9]|[._](?=[a-z0-9])){2,29}$/;

export interface HandleValidation {
  valid: boolean;
  error?: string;
}

export function validateHandle(handle: string): HandleValidation {
  if (handle.length < 3 || handle.length > 30) {
    return { valid: false, error: "Handle must be 3–30 characters." };
  }
  if (!HANDLE_PATTERN.test(handle)) {
    return {
      valid: false,
      error:
        "Handles may contain lowercase letters, numbers, dots, and underscores; separators may not lead, trail, or repeat.",
    };
  }
  if (RESERVED.has(handle.replace(/[._]/g, ""))) {
    return { valid: false, error: "This handle is reserved." };
  }
  return { valid: true };
}

/** Derive a valid handle suggestion from a display name. */
export function suggestHandle(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^[._]+|[._]+$/g, "")
    .replace(/[._]{2,}/g, ".")
    .slice(0, 30)
    .replace(/[._]+$/, "");
  return base.length >= 3 ? base : `${base}${"cf".repeat(2)}`.slice(0, 30);
}
