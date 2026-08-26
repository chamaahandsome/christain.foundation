// Trickl (api.trickl.app) — micro-payments via round-ups, ported from
// Maltivas. NOT a savings/wallet product (that would be money transmission):
// the buyer's spare change is collected in $3 chunks and each chunk is paid
// STRAIGHT THROUGH to the provider's Stripe Connect account — nothing is
// ever held. CF is never in the money flow. Trickl also runs a verified-nonprofit donation
// product (receipts issued for the NGO provider, never by the platform) —
// §9-relevant for phase 7 giving; commerce uses it today.
//
// One host; the KEY decides live vs sandbox (tk_live_… / tk_test_…).

import crypto from "crypto";

const TRICKL_API_BASE = process.env.TRICKL_API_BASE || "https://api.trickl.app";

export const IS_TRICKL_SANDBOX = !!process.env.TRICKL_API_KEY?.startsWith("tk_test_");

export function tricklConfigured(): boolean {
  return Boolean(process.env.TRICKL_API_KEY);
}

// ── Amount limits (pure, tested) ────────────────────────────────────────────
// $3 is the smallest collectible chunk, so also the minimum goal. The max
// scales with the payment window: ~$40 per 45 days, window clamped at 180
// days (ACH dispute exposure) → $160 ceiling.

export const TRICKL_MIN_TARGET_CENTS = 300;
export const TRICKL_RATE_USD = Number(process.env.TRICKL_RATE_USD || 40);
export const TRICKL_RATE_DAYS = Number(process.env.TRICKL_RATE_DAYS || 45);
export const TRICKL_DEFAULT_WINDOW_DAYS = Number(
  process.env.TRICKL_DEFAULT_WINDOW_DAYS || 45,
);
export const TRICKL_MAX_WINDOW_DAYS = Number(process.env.TRICKL_MAX_WINDOW_DAYS || 180);

/** Maximum goal target (cents) for a given payment window. */
export function tricklMaxTargetCents(daysAvailable?: number | null): number {
  const requested =
    daysAvailable && daysAvailable > 0 ? daysAvailable : TRICKL_DEFAULT_WINDOW_DAYS;
  const days = Math.min(requested, TRICKL_MAX_WINDOW_DAYS);
  return Math.round((TRICKL_RATE_USD / TRICKL_RATE_DAYS) * days * 100);
}

/** Whole days between now and an ISO deadline (0 if past/invalid). */
export function daysUntil(deadlineIso: string, now: Date = new Date()): number {
  const d = new Date(deadlineIso);
  if (isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((d.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}

// Final balance charge is ACH (1–3 business days): set goal deadlines this
// many days before the real event so settlement beats the doors.
export const TRICKL_DEADLINE_BUFFER_DAYS = 3;

/** Trickl `deadline` for a time-boxed goal, or null when there is no time
 * left to pay it off (callers hide Trickl rather than failing at checkout). */
export function computeTricklDeadline(
  eventDate: Date | string,
  now: Date = new Date(),
): string | null {
  const event = typeof eventDate === "string" ? new Date(eventDate) : eventDate;
  if (isNaN(event.getTime())) return null;
  const deadline = new Date(
    event.getTime() - TRICKL_DEADLINE_BUFFER_DAYS * 24 * 60 * 60 * 1000,
  );
  const MIN_LEAD_MS = 24 * 60 * 60 * 1000;
  const MAX_LEAD_MS = 2 * 365 * 24 * 60 * 60 * 1000;
  const lead = deadline.getTime() - now.getTime();
  if (lead < MIN_LEAD_MS || lead > MAX_LEAD_MS) return null;
  return deadline.toISOString();
}

/** Validate a goal against the minimum and the window-scaled max. The cap
 * applies to the trickled portion (target − deposit). Returns an error
 * message, or null when the amount is fine. */
export function checkTricklAmount(
  targetCents: number,
  opts?: { daysAvailable?: number | null; depositCents?: number | null },
): string | null {
  if (targetCents < TRICKL_MIN_TARGET_CENTS) {
    return `Amount is below the Trickl minimum ($${(TRICKL_MIN_TARGET_CENTS / 100).toFixed(2)}) — payments are collected in $3 increments.`;
  }
  const deposit = opts?.depositCents && opts.depositCents > 0 ? opts.depositCents : 0;
  const trickledCents = Math.max(0, targetCents - deposit);
  const maxCents = tricklMaxTargetCents(opts?.daysAvailable);
  if (trickledCents > maxCents) {
    const maxUsd = (maxCents / 100).toFixed(0);
    return deposit > 0
      ? `$${(trickledCents / 100).toFixed(2)} would be paid over time, which exceeds the $${maxUsd} limit for this payment window. Increase the deposit or lengthen the window.`
      : `Trickl covers up to $${maxUsd} over this payment window. Add an upfront deposit, lengthen the window, or use another payment method.`;
  }
  return null;
}

// ── Webhook signature (pure, tested) ────────────────────────────────────────

export function verifyTricklSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── API client ──────────────────────────────────────────────────────────────

function headers() {
  const key = process.env.TRICKL_API_KEY;
  if (!key) throw new Error("TRICKL_API_KEY is not configured");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export interface TricklProviderResponse {
  providerLinkCode: string;
  webhookSecret: string;
}

/** Register a channel as a Trickl provider (idempotent on Trickl's side).
 * Rides the channel's Stripe Connect account — Trickl pays it directly. */
export async function registerTricklProvider(data: {
  stripeConnectAccountId: string;
  externalCreatorId: string;
  businessName: string;
  email: string;
  websiteUrl?: string;
  logoUrl?: string;
}): Promise<TricklProviderResponse> {
  const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/webhook/trickl`;
  const res = await fetch(`${TRICKL_API_BASE}/api/v1/external/providers/register`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ ...data, webhookUrl }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(
      (error as { message?: string })?.message ?? `Trickl registration failed (${res.status})`,
    );
  }
  const json = await res.json();
  return json.data || json;
}

export interface TricklGoalParams {
  providerLinkCode: string;
  targetAmount: number; // cents
  description: string;
  metadata?: Record<string, string>;
  callbackUrl?: string;
  cancelUrl?: string;
  depositAmount?: number;
  depositRefundable?: boolean;
  imageUrl?: string;
  deadline?: string; // ISO — time-boxed goals (tickets, premieres)
  frequency?: "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY"; // recurring
}

/** Create a goal; returns the payment URL to send the buyer to. */
export async function createTricklGoal(
  params: TricklGoalParams,
): Promise<{ goalId: string; paymentUrl: string }> {
  const res = await fetch(`${TRICKL_API_BASE}/api/v1/external/goals/create`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ currency: "usd", ...params }),
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(
      (error as { message?: string })?.message ?? `Trickl goal creation failed (${res.status})`,
    );
  }
  const json = await res.json();
  return json.data || json;
}
