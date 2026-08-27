// Ebook domain rules (first purchasable — PLAN §10 phase 6). Pure and
// tested; persistence and checkout live in the routes.

import { checkTricklAmount } from "@/lib/trickl";

export const MAX_EBOOK_PRICE_CENTS = 50_000; // $500 — sanity ceiling

export interface EbookInputCheck {
  ok: boolean;
  errors: string[];
}

export function validateEbookInput(input: {
  title: string;
  priceCents: number;
  author?: string;
  description?: string;
}): EbookInputCheck {
  const errors: string[] = [];
  const title = input.title.trim();
  if (title.length < 2 || title.length > 200) {
    errors.push("Title must be 2–200 characters.");
  }
  if (!Number.isInteger(input.priceCents) || input.priceCents < 0) {
    errors.push("Price must be zero or a positive whole number of cents.");
  } else if (input.priceCents > 0 && input.priceCents < 100) {
    errors.push("Paid books start at $1.00 — below that, make it free.");
  } else if (input.priceCents > MAX_EBOOK_PRICE_CENTS) {
    errors.push(`Price can be at most $${MAX_EBOOK_PRICE_CENTS / 100}.`);
  }
  if (input.author && input.author.length > 120) {
    errors.push("Author can be at most 120 characters.");
  }
  if (input.description && input.description.length > 5000) {
    errors.push("Description can be at most 5000 characters.");
  }
  return { ok: errors.length === 0, errors };
}

/** Who may read a chapter. Staff (owner/team library access) always may;
 * everyone else needs a published book and either a free book, a free-
 * preview chapter, or a purchase. */
export function canReadChapter(input: {
  published: boolean;
  priceCents: number;
  freePreview: boolean;
  purchased: boolean;
  isStaff: boolean;
}): boolean {
  if (input.isStaff) return true;
  if (!input.published) return false;
  if (input.priceCents === 0) return true;
  if (input.freePreview) return true;
  return input.purchased;
}

/** Whether Trickl can be offered for this book: channel has Trickl enabled
 * and the price fits the micro-payment window rules. */
export function tricklEligibleForEbook(input: {
  priceCents: number;
  channelTricklEnabled: boolean;
}): boolean {
  if (!input.channelTricklEnabled) return false;
  if (input.priceCents <= 0) return false;
  return checkTricklAmount(input.priceCents) === null;
}

/** Next chapter sort order: append after the current highest. */
export function nextChapterOrder(existingOrders: number[]): number {
  return existingOrders.length === 0 ? 1 : Math.max(...existingOrders) + 1;
}
