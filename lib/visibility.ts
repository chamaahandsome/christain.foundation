// Which visibilities a library item can take (pure, tested).
//
// An embedded YouTube video is free to anyone on YouTube, so marking it
// members-only or paid here would promise something CF can't deliver: it is
// always public. Members-only and paid are for content CF serves itself.
//
// Plain strings rather than Prisma enums, so the studio's client components
// can share the rule with the API without pulling Prisma into the browser.

export const VISIBILITIES = ["PUBLIC", "MEMBERS", "PAID"] as const;
export type VisibilityValue = (typeof VISIBILITIES)[number];

export function allowedVisibilities(source: string): readonly VisibilityValue[] {
  return source === "EMBEDDED_YOUTUBE" ? ["PUBLIC"] : VISIBILITIES;
}

/** Why an item can't take this visibility — or null when it can. */
export function visibilityProblem(source: string, visibility: string): string | null {
  if (!(VISIBILITIES as readonly string[]).includes(visibility)) {
    return "Unknown visibility.";
  }
  if ((allowedVisibilities(source) as readonly string[]).includes(visibility)) {
    return null;
  }
  return "YouTube videos are always public — anyone can watch them free on YouTube, so they can't be members-only or paid here.";
}
