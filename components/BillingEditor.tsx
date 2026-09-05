"use client";

// The Maltivas invoice/quote editor, CF-skinned: the large A4 document on
// the LEFT (live — exactly what the client's public page shows) and the
// details sidebar on the RIGHT: Your company info (logo gallery, email,
// address — saved to the channel profile), Billing contact, Issue date &
// terms, Line items, Tax & discount, Notes & terms.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BillDocument } from "@/components/BillDocument";
import { ImageUploadDialog } from "@/components/ImageUploadDialog";
import {
  PAYMENT_TERMS,
  computeBillTotals,
  dueDateFor,
  type BillDraft,
  type BillLineItem,
  type PaymentTermsKey,
} from "@/lib/billing";

export function BillingEditor({
  kind,
  channelId,
  channelName,
  logoUrl: initialLogo,
  logoHistory = [],
  companyEmail: initialEmail = "",
  companyAddress: initialAddress = "",
  initial,
}: {
  kind: "invoice" | "quote";
  channelId: string;
  channelName: string;
  logoUrl: string | null;
  logoHistory?: string[];
  companyEmail?: string;
  companyAddress?: string;
  initial: BillDraft;
}) {
  const router = useRouter();
  const [d, setD] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const editable = d.status === "draft";

  // Company info lives on the channel profile — shared by every document.
  const [logoUrl, setLogoUrl] = useState(initialLogo);
  const [recentLogos, setRecentLogos] = useState(logoHistory);
  const [logoDialog, setLogoDialog] = useState(false);
  const [companyEmail, setCompanyEmail] = useState(initialEmail);
  const [companyAddress, setCompanyAddress] = useState(initialAddress);

  function applyLogo(url: string | null) {
    setLogoUrl(url);
    if (url) setRecentLogos((h) => [url, ...h.filter((u) => u !== url)].slice(0, 3));
    void fetch("/api/studio/business/logo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channelId, logoUrl: url }),
    }).catch(() => {});
  }
  function saveCompany() {
    void fetch("/api/studio/business/company", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        channelId,
        businessEmail: companyEmail.trim() || null,
        businessAddress: companyAddress.trim() || null,
      }),
    }).catch(() => {});
  }

  const set = <K extends keyof BillDraft>(key: K, value: BillDraft[K]) =>
    setD((prev) => ({ ...prev, [key]: value }));
  const setItem = (i: number, patch: Partial<BillLineItem>) =>
    setD((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((li, j) => (j === i ? { ...li, ...patch } : li)),
    }));

  const totals = computeBillTotals(d);
  const apiBase = kind === "invoice" ? "/api/studio/invoices" : "/api/studio/quotes";
  const backHref = `/studio/channel/${channelId}/business?tab=${kind === "invoice" ? "invoices" : "quotes"}`;

  async function save(thenSend: boolean) {
    setBusy(thenSend ? "Sending…" : "Saving…");
    setError(null);
    try {
      const payload = {
        channelId,
        clientName: d.clientName,
        clientEmail: d.clientEmail,
        title: d.title,
        lineItems: d.lineItems,
        taxBps: d.taxBps,
        discountCents: d.discountCents,
        notes: d.notes.trim() || null,
        terms: d.terms.trim() || null,
        ...(kind === "invoice"
          ? { paymentTerms: d.paymentTerms }
          : { validDays: d.validDays }),
      };
      const res = await fetch(apiBase, {
        method: d.id ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          d.id ? { ...payload, action: "edit", [`${kind}Id`]: d.id } : payload,
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Save failed (${res.status})`);
        return;
      }
      const saved = (data.invoice ?? data.quote) as { id: string } | undefined;
      const id = d.id ?? saved?.id;
      if (thenSend && id) {
        const send = await fetch(apiBase, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ channelId, [`${kind}Id`]: id, action: "send" }),
        });
        const sendData = await send.json().catch(() => ({}));
        if (!send.ok) {
          setError(sendData.error ?? `Send failed (${send.status})`);
          return;
        }
      }
      router.push(backHref);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const input =
    "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-amber-600";
  const label = "block text-xs font-medium text-neutral-500";
  const card =
    "rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800";
  const today = new Date().toLocaleDateString();
  const secondaryDate =
    kind === "invoice"
      ? dueDateFor(d.paymentTerms, new Date()).toLocaleDateString()
      : new Date(Date.now() + d.validDays * 86_400_000).toLocaleDateString();

  return (
    <div className="mx-[calc(50%-50vw)] mt-4 px-4 sm:px-6 lg:px-10">
      {/* Header bar */}
      <div className="sticky top-14 z-30 -mx-4 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10 dark:border-neutral-800 dark:bg-neutral-950/95">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3">
          <Link
            href={backHref}
            className="shrink-0 rounded-lg px-2 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            ← Back
          </Link>
          <h1 className="text-lg font-semibold">
            {d.id ? (kind === "invoice" ? "Invoice" : "Quote") : kind === "invoice" ? "Create invoice" : "Create quote"}
          </h1>
          <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            {d.status}
          </span>
          <div className="ml-auto flex items-center gap-3">
            {editable && (
              <>
                <button
                  onClick={() => void save(false)}
                  disabled={busy !== null}
                  className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:border-amber-500 hover:text-amber-700 disabled:opacity-50 dark:border-neutral-700 dark:hover:text-amber-400"
                >
                  {busy === "Saving…" ? "Saving…" : "💾 Save draft"}
                </button>
                <button
                  onClick={() => void save(true)}
                  disabled={
                    busy !== null ||
                    d.clientName.trim().length < 2 ||
                    !d.clientEmail.includes("@") ||
                    !d.title.trim() ||
                    totals.totalCents < 100
                  }
                  title={
                    totals.totalCents < 100
                      ? "Add at least one line item ($1 minimum)"
                      : `Email the ${kind} to ${d.clientEmail || "the client"}`
                  }
                  className="shrink-0 rounded-lg bg-linear-to-r from-amber-500 to-orange-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500 disabled:opacity-50"
                >
                  {busy === "Sending…" ? "Sending…" : "📨 Create & send"}
                </button>
              </>
            )}
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      {/* Document LEFT (large) · details RIGHT — the Maltivas layout */}
      <div className="mx-auto mt-6 grid max-w-[1500px] gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {/* ── The document ── */}
        <div className="lg:sticky lg:top-32 lg:self-start">
          <BillDocument
            kind={kind}
            number={d.number}
            title={d.title}
            channelName={channelName}
            logoUrl={logoUrl}
            companyEmail={companyEmail.trim() || null}
            companyAddress={companyAddress.trim() || null}
            clientName={d.clientName}
            clientEmail={d.clientEmail}
            issuedDate={today}
            secondaryDate={secondaryDate}
            lineItems={d.lineItems.filter(
              (li) => li.item.trim() || li.details.trim() || li.rateCents > 0,
            )}
            taxBps={d.taxBps}
            discountCents={d.discountCents}
            notes={d.notes.trim() || null}
            terms={d.terms.trim() || null}
            status={d.status}
          />
        </div>

        {/* ── Details sidebar ── */}
        <div className="space-y-5">
          {/* Your company info */}
          <div className={card}>
            <h3 className="text-sm font-semibold">🏢 Your company info</h3>
            <div className="mt-3 space-y-3">
              {recentLogos.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
                    Recent logos (click to use)
                  </p>
                  <div className="mt-1.5 grid grid-cols-3 gap-2">
                    {recentLogos.map((url) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => applyLogo(url)}
                        className={`relative aspect-square overflow-hidden rounded-lg border-2 bg-white p-1 ${
                          logoUrl === url
                            ? "border-green-500"
                            : "border-neutral-200 hover:border-amber-400 dark:border-neutral-700"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="h-full w-full object-contain" />
                        {logoUrl === url && (
                          <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[9px] text-white">
                            ✓
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
                    Company logo
                  </p>
                  {logoUrl && (
                    <span className="text-[11px] font-medium text-green-600 dark:text-green-400">
                      ✓ Saved to profile
                    </span>
                  )}
                </div>
                {logoUrl ? (
                  <div className="group relative mt-1.5 flex h-16 items-center justify-center rounded-lg border border-neutral-200 bg-white dark:border-neutral-700">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoUrl} alt="Company logo" className="h-12 object-contain" />
                    <button
                      type="button"
                      onClick={() => applyLogo(null)}
                      title="Remove logo"
                      className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white group-hover:flex"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setLogoDialog(true)}
                    className="mt-1.5 w-full rounded-lg border border-dashed border-neutral-300 px-3 py-3 text-xs text-neutral-500 hover:border-amber-500 hover:text-amber-700 dark:border-neutral-700 dark:hover:text-amber-400"
                  >
                    Upload a logo
                  </button>
                )}
                <p className="mt-1 text-[11px] text-neutral-400">
                  Used for all new contracts, invoices, and quotes.
                </p>
              </div>
              <label className={label}>
                Organization name
                <input value={channelName} disabled className={`${input} mt-1`} />
              </label>
              <label className={label}>
                ✉️ Email
                <input
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  onBlur={saveCompany}
                  type="email"
                  placeholder="billing@yourministry.org"
                  className={`${input} mt-1`}
                />
              </label>
              <label className={label}>
                📍 Address
                <textarea
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  onBlur={saveCompany}
                  rows={2}
                  maxLength={500}
                  placeholder={"123 Business Street\nCity, State ZIP"}
                  className={`${input} mt-1`}
                />
              </label>
            </div>
          </div>

          {/* Billing contact */}
          <div className={card}>
            <h3 className="text-sm font-semibold">👤 Billing contact</h3>
            <div className="mt-3 space-y-3">
              <label className={label}>
                Client name
                <input
                  value={d.clientName}
                  onChange={(e) => set("clientName", e.target.value)}
                  disabled={!editable}
                  placeholder="John Doe"
                  className={`${input} mt-1`}
                />
              </label>
              <label className={label}>
                ✉️ Email
                <input
                  value={d.clientEmail}
                  onChange={(e) => set("clientEmail", e.target.value)}
                  disabled={!editable}
                  type="email"
                  placeholder="client@example.com"
                  className={`${input} mt-1`}
                />
              </label>
              <label className={label}>
                What this {kind} covers
                <input
                  value={d.title}
                  onChange={(e) => set("title", e.target.value)}
                  disabled={!editable}
                  placeholder={kind === "invoice" ? "Conference media package" : "Event coverage"}
                  className={`${input} mt-1`}
                />
              </label>
            </div>
          </div>

          {/* Issue date & terms */}
          <div className={card}>
            <h3 className="text-sm font-semibold">📅 Issue date</h3>
            <p className="mt-2 inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm dark:border-neutral-700">
              🗓 Today <span className="text-neutral-400">{today}</span>
            </p>
            <div className="mt-3">
              {kind === "invoice" ? (
                <label className={label}>
                  Payment terms
                  <select
                    value={d.paymentTerms}
                    onChange={(e) => set("paymentTerms", e.target.value)}
                    disabled={!editable}
                    className={`${input} mt-1 [&>option]:dark:bg-neutral-900`}
                  >
                    {Object.entries(PAYMENT_TERMS).map(([key, t]) => (
                      <option key={key} value={key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-[11px] font-normal normal-case text-neutral-400">
                    Due: {secondaryDate} (from the send date)
                  </span>
                </label>
              ) : (
                <label className={label}>
                  Valid for (days)
                  <input
                    value={d.validDays}
                    onChange={(e) =>
                      set("validDays", Math.max(1, Number(e.target.value) || 30))
                    }
                    disabled={!editable}
                    type="number"
                    min={1}
                    className={`${input} mt-1`}
                  />
                  <span className="mt-1 block text-[11px] font-normal normal-case text-neutral-400">
                    Valid until: {secondaryDate}
                  </span>
                </label>
              )}
            </div>
          </div>

          {/* Line items */}
          <div className={card}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">🧾 Line items</h3>
              {editable && (
                <button
                  onClick={() =>
                    set("lineItems", [
                      ...d.lineItems,
                      { item: "", details: "", qty: 1, rateCents: 0 },
                    ])
                  }
                  className="rounded-lg bg-linear-to-r from-amber-500 to-orange-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500"
                >
                  + Add item
                </button>
              )}
            </div>
            <div className="mt-3 space-y-3">
              {d.lineItems.map((li, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-700"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[11px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      {i + 1}
                    </span>
                    {editable && d.lineItems.length > 1 && (
                      <button
                        onClick={() =>
                          set("lineItems", d.lineItems.filter((_, j) => j !== i))
                        }
                        title="Remove item"
                        className="rounded-md px-1.5 py-0.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <input
                      value={li.item}
                      onChange={(e) => setItem(i, { item: e.target.value })}
                      disabled={!editable}
                      placeholder="Item"
                      className={input}
                    />
                    <input
                      value={li.details}
                      onChange={(e) => setItem(i, { details: e.target.value })}
                      disabled={!editable}
                      placeholder="Details (optional)"
                      className={input}
                    />
                    <div className="flex items-center gap-1 rounded-lg border border-neutral-300 px-3 dark:border-neutral-700">
                      <span className="text-xs text-neutral-500">Qty</span>
                      <input
                        value={li.qty}
                        onChange={(e) =>
                          setItem(i, { qty: Math.max(1, Number(e.target.value) || 1) })
                        }
                        disabled={!editable}
                        type="number"
                        min={1}
                        className="w-full bg-transparent py-2 text-sm outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1 rounded-lg border border-neutral-300 px-3 dark:border-neutral-700">
                      <span className="text-sm text-neutral-500">$</span>
                      <input
                        value={li.rateCents ? li.rateCents / 100 : ""}
                        onChange={(e) =>
                          setItem(i, {
                            rateCents: Math.round((Number(e.target.value) || 0) * 100),
                          })
                        }
                        disabled={!editable}
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="rate"
                        className="w-full bg-transparent py-2 text-sm outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tax & discount */}
          <div className={card}>
            <h3 className="text-sm font-semibold">％ Tax & discount</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className={label}>
                Tax %
                <input
                  value={d.taxBps ? d.taxBps / 100 : ""}
                  onChange={(e) =>
                    set("taxBps", Math.round((Number(e.target.value) || 0) * 100))
                  }
                  disabled={!editable}
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0"
                  className={`${input} mt-1`}
                />
              </label>
              <label className={label}>
                Discount $
                <input
                  value={d.discountCents ? d.discountCents / 100 : ""}
                  onChange={(e) =>
                    set("discountCents", Math.round((Number(e.target.value) || 0) * 100))
                  }
                  disabled={!editable}
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0"
                  className={`${input} mt-1`}
                />
              </label>
            </div>
          </div>

          {/* Notes & terms */}
          <div className={card}>
            <h3 className="text-sm font-semibold">📝 Notes & terms</h3>
            <textarea
              value={d.notes}
              onChange={(e) => set("notes", e.target.value)}
              disabled={!editable}
              rows={2}
              maxLength={4000}
              placeholder="Notes to the client (optional) — shown on the document"
              className={`${input} mt-3`}
            />
            <textarea
              value={d.terms}
              onChange={(e) => set("terms", e.target.value)}
              disabled={!editable}
              rows={3}
              maxLength={4000}
              placeholder="Terms & conditions footer"
              className={`${input} mt-2`}
            />
          </div>
        </div>
      </div>

      <ImageUploadDialog
        open={logoDialog}
        title="Company logo"
        channelId={channelId}
        aspect={1}
        allowRemove={false}
        onCancel={() => setLogoDialog(false)}
        onDone={(url) => {
          setLogoDialog(false);
          if (url) applyLogo(url);
        }}
      />
    </div>
  );
}
