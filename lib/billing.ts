// Structured billing documents (quotes & invoices) — pure rules, tested.
// The Maltivas invoice/quote shape: line items (qty × rate), tax as basis
// points, a discount, and payment terms that compute the due date.

import { DEFAULT_INVOICE_TERMS, DEFAULT_QUOTE_TERMS } from "@/lib/default-templates";

export interface BillLineItem {
  item: string;
  details: string;
  qty: number;
  rateCents: number;
}

export const PAYMENT_TERMS = {
  "due-on-receipt": { label: "Due on receipt", days: 0 },
  "net-15": { label: "Net 15", days: 15 },
  "net-30": { label: "Net 30", days: 30 },
  "net-60": { label: "Net 60", days: 60 },
} as const;

export type PaymentTermsKey = keyof typeof PAYMENT_TERMS;

export function dueDateFor(terms: string, from: Date): Date {
  const days = PAYMENT_TERMS[terms as PaymentTermsKey]?.days ?? 0;
  return new Date(from.getTime() + days * 86_400_000);
}

/** Parse stored/posted line items, dropping malformed rows and clamping
 * numbers to sane, non-negative integers. */
export function parseLineItems(raw: unknown): BillLineItem[] {
  if (!Array.isArray(raw)) return [];
  const items: BillLineItem[] = [];
  for (const row of raw.slice(0, 50)) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    const item = typeof r.item === "string" ? r.item.slice(0, 300) : "";
    const details = typeof r.details === "string" ? r.details.slice(0, 1000) : "";
    const qty =
      typeof r.qty === "number" && Number.isFinite(r.qty)
        ? Math.min(Math.max(Math.round(r.qty), 1), 100_000)
        : 1;
    const rateCents =
      typeof r.rateCents === "number" && Number.isFinite(r.rateCents)
        ? Math.min(Math.max(Math.round(r.rateCents), 0), 100_000_000)
        : 0;
    if (!item.trim() && !details.trim() && rateCents === 0) continue;
    items.push({ item, details, qty, rateCents });
  }
  return items;
}

export interface BillTotals {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
}

/** Subtotal − discount, then tax on the discounted base (never below 0). */
export function computeBillTotals(input: {
  lineItems: BillLineItem[];
  taxBps?: number;
  discountCents?: number;
}): BillTotals {
  const subtotalCents = input.lineItems.reduce(
    (sum, li) => sum + li.qty * li.rateCents,
    0,
  );
  const discountCents = Math.min(
    Math.max(Math.round(input.discountCents ?? 0), 0),
    subtotalCents,
  );
  const taxBps = Math.min(Math.max(Math.round(input.taxBps ?? 0), 0), 10_000);
  const base = subtotalCents - discountCents;
  const taxCents = Math.round((base * taxBps) / 10_000);
  return { subtotalCents, discountCents, taxCents, totalCents: base + taxCents };
}

/* ---------- editor draft shape ----------
 * Shared by the client editor and the server pages that seed it. */

export interface BillDraft {
  id: string | null;
  number: string;
  clientName: string;
  clientEmail: string;
  title: string;
  lineItems: BillLineItem[];
  taxBps: number;
  discountCents: number;
  paymentTerms: string; // invoice only
  validDays: number; // quote only
  notes: string;
  terms: string;
  status: string;
}

export function emptyBillDraft(kind: "invoice" | "quote"): BillDraft {
  return {
    id: null,
    number: kind === "invoice" ? "INV-…" : "QUO-…",
    clientName: "",
    clientEmail: "",
    title: "",
    lineItems: [{ item: "", details: "", qty: 1, rateCents: 0 }],
    taxBps: 0,
    discountCents: 0,
    paymentTerms: "due-on-receipt",
    validDays: 30,
    notes: "",
    terms: kind === "invoice" ? DEFAULT_INVOICE_TERMS : DEFAULT_QUOTE_TERMS,
    status: "draft",
  };
}

/* ---------- quote → contract ----------
 * An accepted quote mints a contract draft. Structured quotes carry
 * their line items in as a table (legacy quotes fall back to their
 * description), and the draft arrives with both signature chips so it
 * is signing-ready in the editor. */

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const centsToDollars = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export function contractContentFromQuote(quote: {
  quoteNumber: string;
  title: string;
  description?: string | null;
  lineItems?: unknown;
  taxBps?: number;
  discountCents?: number;
  amountCents: number;
  terms?: string | null;
}): string {
  const items = parseLineItems(quote.lineItems);
  const totals = computeBillTotals({
    lineItems: items,
    taxBps: quote.taxBps,
    discountCents: quote.discountCents,
  });
  const total = items.length > 0 ? totals.totalCents : quote.amountCents;

  let scope = "";
  if (items.length > 0) {
    const rows = items
      .map(
        (li) =>
          `<tr><td><p>${escapeHtml(li.item)}</p></td>` +
          `<td><p>${escapeHtml(li.details)}</p></td>` +
          `<td><p>${li.qty}</p></td>` +
          `<td><p>${centsToDollars(li.rateCents)}</p></td>` +
          `<td><p>${centsToDollars(li.qty * li.rateCents)}</p></td></tr>`,
      )
      .join("");
    const extras =
      (totals.discountCents > 0
        ? `<li>Discount: −${centsToDollars(totals.discountCents)}</li>`
        : "") +
      (totals.taxCents > 0 ? `<li>Tax: ${centsToDollars(totals.taxCents)}</li>` : "");
    scope =
      `<h2>Scope of work</h2>` +
      `<table><tbody>` +
      `<tr><th><p>Item</p></th><th><p>Details</p></th><th><p>Qty</p></th><th><p>Rate</p></th><th><p>Amount</p></th></tr>` +
      rows +
      `</tbody></table>` +
      (extras ? `<ul>${extras}</ul>` : "");
  } else if (quote.description) {
    scope = quote.description.includes("<")
      ? `<h2>Scope of work</h2>${quote.description}`
      : `<h2>Scope of work</h2><p>${escapeHtml(quote.description)}</p>`;
  }

  return (
    `<h1>${escapeHtml(quote.title)}</h1>` +
    `<p>This agreement follows accepted quote ${escapeHtml(quote.quoteNumber)}. ` +
    `In consideration of the mutual obligations below, the parties agree:</p>` +
    scope +
    `<h2>Payment</h2>` +
    `<p>The total fee is ${centsToDollars(total)}, payable as the parties have agreed${
      quote.terms ? `, per the quoted terms: ${escapeHtml(quote.terms)}` : ""
    }.</p>` +
    `<h2>Signatures</h2>` +
    `<p>IN WITNESS WHEREOF, the parties have executed this Agreement.</p>` +
    `<p><strong>Provider:</strong><br /><span data-signature-field="" data-signer="creator">✍️ Your signature</span></p>` +
    `<p><strong>Client:</strong><br /><span data-signature-field="" data-signer="client">✍️ Client signature</span></p>`
  );
}
