// The A4 billing document (the Maltivas InvoicePreview/QuotePreview look,
// CF-skinned): letterhead, document heading + number, from / bill-to,
// line-items table, totals, notes, terms. Pure presentational — no hooks —
// so both the client-side live preview and the public token pages (RSC)
// render the same paper.

import { computeBillTotals, type BillLineItem } from "@/lib/billing";

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export interface BillDocumentProps {
  kind: "invoice" | "quote";
  number: string;
  title: string;
  channelName: string;
  logoUrl?: string | null;
  companyEmail?: string | null;
  companyAddress?: string | null;
  clientName: string;
  clientEmail?: string | null;
  issuedDate: string;
  /** invoice: due date · quote: valid-until date */
  secondaryDate?: string | null;
  lineItems: BillLineItem[];
  taxBps?: number;
  discountCents?: number;
  /** fallback when there are no structured line items (legacy rows) */
  amountCents?: number;
  notes?: string | null;
  terms?: string | null;
  status?: string | null;
}

export function BillDocument(props: BillDocumentProps) {
  const totals = computeBillTotals({
    lineItems: props.lineItems,
    taxBps: props.taxBps,
    discountCents: props.discountCents,
  });
  const total =
    props.lineItems.length > 0 ? totals.totalCents : (props.amountCents ?? 0);

  return (
    <div className="overflow-hidden rounded-[3px] border border-neutral-200 bg-white text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_12px_32px_rgba(0,0,0,0.10)]">
      {/* Accent bar */}
      <div className="h-1.5 bg-linear-to-r from-amber-500 to-orange-600" />
      {/* Letterhead */}
      <div className="flex items-start justify-between gap-6 px-8 pb-6 pt-8">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {props.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={props.logoUrl} alt="" className="h-12 w-12 shrink-0 rounded object-contain" />
            )}
            <p className="text-xl font-bold">{props.channelName}</p>
          </div>
          <div className="mt-3 space-y-0.5 text-xs text-neutral-500">
            {props.companyEmail && <p>{props.companyEmail}</p>}
            {props.companyAddress &&
              props.companyAddress.split("\n").map((line, i) => <p key={i}>{line}</p>)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-3xl font-extrabold uppercase tracking-[0.2em] text-neutral-800">
            {props.kind === "invoice" ? "Invoice" : "Quote"}
          </p>
          <p className="mt-0.5 font-mono text-xs text-neutral-500"># {props.number}</p>
          {props.status && props.status !== "draft" && (
            <p className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
              {props.status.replace(/_/g, " ")}
            </p>
          )}
          <div className="mt-4 rounded-lg bg-neutral-50 px-4 py-3 text-left">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
              {props.kind === "invoice" ? "Amount due" : "Quote total"}
            </p>
            <p className="mt-0.5 text-2xl font-bold text-amber-700">{money(total)}</p>
          </div>
        </div>
      </div>

      {/* Parties + dates */}
      <div className="grid gap-6 px-8 py-6 sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
            From
          </p>
          <p className="mt-1 text-sm font-medium">{props.channelName}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
            {props.kind === "invoice" ? "Bill to" : "Prepared for"}
          </p>
          <p className="mt-1 text-sm font-medium">{props.clientName || "—"}</p>
          {props.clientEmail && (
            <p className="text-xs text-neutral-500">{props.clientEmail}</p>
          )}
        </div>
        <div className="sm:text-right">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
            Dates
          </p>
          <p className="mt-1 text-xs text-neutral-600">Issued {props.issuedDate}</p>
          {props.secondaryDate && (
            <p className="text-xs font-medium text-neutral-800">
              {props.kind === "invoice" ? "Due" : "Valid until"} {props.secondaryDate}
            </p>
          )}
        </div>
      </div>

      {/* Title */}
      {props.title && (
        <p className="px-8 pb-2 text-sm font-semibold">{props.title}</p>
      )}

      {/* Line items */}
      <div className="px-8">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-neutral-900 text-left text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
              <th className="py-2 pr-3">Item</th>
              <th className="py-2 pr-3">Details</th>
              <th className="py-2 pr-3 text-right">Qty</th>
              <th className="py-2 pr-3 text-right">Rate</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {props.lineItems.length === 0 ? (
              <tr className="border-b border-neutral-100">
                <td className="py-3 pr-3 font-medium">{props.title || "—"}</td>
                <td className="py-3 pr-3 text-neutral-500" />
                <td className="py-3 pr-3 text-right">1</td>
                <td className="py-3 pr-3 text-right">{money(total)}</td>
                <td className="py-3 text-right font-medium">{money(total)}</td>
              </tr>
            ) : (
              props.lineItems.map((li, i) => (
                <tr key={i} className="border-b border-neutral-100 align-top">
                  <td className="py-3 pr-3 font-medium">{li.item || "—"}</td>
                  <td className="py-3 pr-3 text-neutral-500">{li.details}</td>
                  <td className="py-3 pr-3 text-right">{li.qty}</td>
                  <td className="py-3 pr-3 text-right">{money(li.rateCents)}</td>
                  <td className="py-3 text-right font-medium">
                    {money(li.qty * li.rateCents)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div className="ml-auto mt-4 w-56 space-y-1 text-sm">
          {props.lineItems.length > 0 && (
            <>
              <div className="flex justify-between text-neutral-600">
                <span>Subtotal</span>
                <span>{money(totals.subtotalCents)}</span>
              </div>
              {totals.discountCents > 0 && (
                <div className="flex justify-between text-neutral-600">
                  <span>Discount</span>
                  <span>−{money(totals.discountCents)}</span>
                </div>
              )}
              {totals.taxCents > 0 && (
                <div className="flex justify-between text-neutral-600">
                  <span>Tax ({((props.taxBps ?? 0) / 100).toFixed(2).replace(/\.?0+$/, "")}%)</span>
                  <span>{money(totals.taxCents)}</span>
                </div>
              )}
            </>
          )}
          <div className="flex justify-between border-t-2 border-neutral-900 pt-1.5 text-base font-bold">
            <span>Total</span>
            <span>{money(total)}</span>
          </div>
        </div>
      </div>

      {/* Notes + terms */}
      <div className="space-y-4 px-8 pb-8 pt-6">
        {props.notes && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
              Notes
            </p>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-neutral-600">
              {props.notes}
            </p>
          </div>
        )}
        {props.terms && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
              Terms
            </p>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-neutral-500">
              {props.terms}
            </p>
          </div>
        )}
        <p className="border-t border-neutral-100 pt-4 text-center text-[10px] text-neutral-400">
          {props.channelName} · via Christian Foundation
        </p>
      </div>
    </div>
  );
}
