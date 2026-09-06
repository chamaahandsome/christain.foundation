// Contracts (Do-Biz core) — pure rules, tested. Lifecycle:
// DRAFT → SENT → VIEWED → SIGNED, with DECLINED / EXPIRED / CANCELLED exits.

import crypto from "crypto";
import {
  countUnassignedClientChips,
  getUniqueRecipients,
  parseContractRecipients,
} from "./contract-fields";

export const SIGN_TOKEN_TTL_DAYS = 14;
export const CONTRACT_CONSENT_TEXT =
  "By signing, I agree that this electronic signature is the legal equivalent " +
  "of my handwritten signature and that I have read and accept the terms above.";

export function nextDocNumber(prefix: string, lastNumber: string | null): string {
  const n = lastNumber ? parseInt(lastNumber.replace(new RegExp(`^${prefix}-`), ""), 10) : 0;
  return `${prefix}-${String((Number.isFinite(n) ? n : 0) + 1).padStart(3, "0")}`;
}

export function nextContractNumber(lastNumber: string | null): string {
  return nextDocNumber("CON", lastNumber);
}

export function validateContractDraft(input: {
  title: string;
  clientName: string;
  clientEmail: string;
  content: string;
  amountCents?: number | null;
  recipients?: unknown;
}): string | null {
  if (input.title.trim().length < 4) return "Give the contract a real title.";

  // Recipients can come from three places: emails assigned on signature
  // chips, the primary client, and additional clients. Send needs at
  // least one — and the primary client specifically when any chip is
  // unassigned (unassigned chips fall to them) or when there are no
  // chip assignments at all and no additional clients.
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.clientEmail.trim());
  const assigned = getUniqueRecipients(input.content);
  const unassigned = countUnassignedClientChips(input.content);
  const extras = parseContractRecipients(input.recipients);
  if (input.clientEmail.trim() && !emailOk) {
    return "The client email doesn't look valid.";
  }
  if (emailOk && input.clientName.trim().length < 2) {
    return "Who is the client? Add their name.";
  }
  if (unassigned > 0 && !emailOk && assigned.length === 0 && extras.length === 0) {
    return "Assign an email to each signature field, or fill in the client email — unassigned fields go to the client.";
  }
  if (assigned.length === 0 && extras.length === 0 && !emailOk) {
    return "Add at least one signer: assign a signature field an email, or fill in the client email.";
  }
  if (unassigned > 0 && !emailOk && (assigned.length > 0 || extras.length > 0)) {
    return "Some signature fields have no email — assign them, or fill in the client email so they fall to the client.";
  }
  const text = input.content.replace(/<[^>]+>/g, " ").trim();
  if (text.length < 40) {
    return "The contract body is too short to be an agreement.";
  }
  if (
    input.amountCents !== undefined &&
    input.amountCents !== null &&
    (!Number.isInteger(input.amountCents) || input.amountCents < 0)
  ) {
    return "The amount must be a whole number of cents, or left blank.";
  }
  return null;
}

/** A token is usable while unexpired and unused, on a contract still open
 * for signing (SENT/VIEWED, or PARTIALLY_SIGNED while co-signers remain). */
export function tokenUsable(
  t: { expiresAt: Date; usedAt: Date | null },
  contractStatus: string,
  now: Date = new Date(),
): "ok" | "used" | "expired" | "closed" {
  if (t.usedAt) return "used";
  if (t.expiresAt.getTime() <= now.getTime()) return "expired";
  if (
    contractStatus !== "SENT" &&
    contractStatus !== "VIEWED" &&
    contractStatus !== "PARTIALLY_SIGNED"
  ) {
    return "closed";
  }
  return "ok";
}

export function generateSignToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/** SHA-256 of the frozen signed content — the public integrity check. */
export function contractHash(signedContent: string): string {
  return crypto.createHash("sha256").update(signedContent, "utf8").digest("hex");
}

export function validateBookingRequest(input: {
  requesterName: string;
  requesterEmail: string;
  message: string;
  budgetCents?: number | null;
}): string | null {
  if (input.requesterName.trim().length < 2) return "Tell them who you are.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.requesterEmail.trim())) {
    return "Enter a valid email so they can reply.";
  }
  if (input.message.trim().length < 20) {
    return "Describe the engagement — a sentence or two at least.";
  }
  if (
    input.budgetCents !== undefined &&
    input.budgetCents !== null &&
    (!Number.isInteger(input.budgetCents) || input.budgetCents < 0)
  ) {
    return "The budget must be a positive amount, or left blank.";
  }
  return null;
}

export function validateTemplate(input: { name: string; content: string }): string | null {
  if (input.name.trim().length < 2) return "Name the template.";
  const text = input.content.replace(/<[^>]+>/g, " ").trim();
  if (text.length < 40) return "The template body is too short to be useful.";
  return null;
}

/** The contract draft an accepted booking starts from. */
export function bookingContractContent(b: {
  requesterName: string;
  organization: string | null;
  eventDate: Date | null;
  location: string | null;
  message: string;
}): string {
  const when = b.eventDate ? b.eventDate.toLocaleDateString() : "date to be confirmed";
  const where = b.location ?? "location to be confirmed";
  return (
    `<h2>Engagement agreement</h2>` +
    `<p>This agreement covers an engagement requested by ${b.requesterName}` +
    `${b.organization ? ` (${b.organization})` : ""} — ${when}, ${where}.</p>` +
    `<h3>The request</h3><blockquote><p>${b.message
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")}</p></blockquote>` +
    `<h3>Scope</h3><p>Describe what is agreed: sessions, times, travel, and expectations.</p>` +
    `<h3>Payment</h3><p>State the amount, when it is due, and how it will be paid.</p>` +
    `<h3>Terms</h3><ul><li>Cancellation…</li><li>This agreement is governed by…</li></ul>`
  );
}

// Document field-bubble helpers live in lib/contract-fields (no node
// imports — client components use them too).
export * from "./contract-fields";
