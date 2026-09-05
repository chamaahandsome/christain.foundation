"use client";

// The Do-Biz dashboard, CF-skinned and flow-identical to Maltivas:
// Overview (stats + recent activity, Create-agreement button) · Bookings
// (Services / Requests sub-tabs) · Quotes · Contracts (template modal →
// editor page) · Invoices. First visit without a signature opens the
// signature modal.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SignatureSetupModal } from "@/components/SignatureSetupModal";
import { TemplateModalCF, type PickerTemplate } from "@/components/TemplateModalCF";
import { ServicesEditor, type Service } from "@/components/ServicesEditor";
import { FeatureTour, useFirstVisit, type TourStep } from "@/components/FeatureTour";

interface ContractRow {
  id: string;
  contractNumber: string;
  title: string;
  clientName: string;
  status: string;
  preview: string;
  signedAt: string | null;
  date: string;
  lastActivity: string | null;
  /** signatures recorded / signature fields in the document */
  sigSigned: number;
  sigTotal: number;
}
interface BookingRow {
  id: string;
  requesterName: string;
  requesterEmail: string;
  organization: string | null;
  eventDate: string | null;
  location: string | null;
  budgetCents: number | null;
  message: string;
  status: string;
  decisionNote: string | null;
  contractId: string | null;
  date: string;
}
interface QuoteRow {
  id: string;
  quoteNumber: string;
  title: string;
  clientName: string;
  clientEmail: string;
  amountCents: number;
  status: string;
  token: string;
  date: string;
  expiresAt: string | null;
}
interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  title: string;
  clientName: string;
  clientEmail: string;
  amountCents: number;
  status: string;
  token: string;
  date: string;
  dueAt: string | null;
}

const money = (cents: number) => `$${(cents / 100).toLocaleString()}`;

// Build a signing-ready business in six steps — the Do-Biz guide.
const DOBIZ_TOUR: TourStep[] = [
  {
    icon: "✒️",
    title: "Create your signature once",
    body: "Your digital signature (typed in cursive or drawn) is stored on your channel and signs every contract you send.",
  },
  {
    icon: "🗂",
    title: "Pick a template or start blank",
    body: "The template library covers ministry agreements — speaking, worship, licensing, NDAs. Preview one, agree, and it opens in the editor.",
    anchor: '[data-tour="biz-create"]',
  },
  {
    icon: "🔶",
    title: "Fill the highlighted chips",
    body: "Every template has fill-in chips. Click a chip to set its value, or hand it to the signer to complete on the signing page.",
  },
  {
    icon: "✍️",
    title: "Place signature fields",
    body: "Signature fields mark exactly where each party signs. Assign each one an email — every unique signer gets their own secure link.",
  },
  {
    icon: "📨",
    title: "Send, track, get signed",
    body: "Sending emails the links and signs for you. Watch sent → viewed → partially signed → signed, with a tamper-proof verify page at the end.",
  },
  {
    icon: "🧾",
    title: "Quotes, bookings, invoices",
    body: "Quote a booking request (accepting mints a contract), link an invoice to a contract so it's emailed the moment everyone signs, and mark it paid.",
    anchor: '[data-tour="biz-tabs"]',
  },
];

const BADGE: Record<string, string> = {
  DRAFT: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  draft: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  SENT: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  sent: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  VIEWED: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  viewed: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  SIGNED: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  PARTIALLY_SIGNED: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  accepted: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  paid: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  ACCEPTED: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  DECLINED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  declined: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  DECLINED_: "",
  EXPIRED: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
  expired: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
  CANCELLED: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
  void: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
};

function Badge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium uppercase ${BADGE[status] ?? BADGE.DRAFT}`}
    >
      {status.toLowerCase().replace(/_/g, " ")}
    </span>
  );
}

/* The Maltivas contract card: a mini document page (title + text snippet)
   over a footer strip with status, date, and the ✍ signed/total count. */
function ContractCard({ c, channelId }: { c: ContractRow; channelId: string }) {
  return (
  <Link
    href={
      c.status === "SIGNED"
        ? `/verify/${c.id}`
        : `/studio/channel/${channelId}/business/contracts/${c.id}`
    }
    className="group overflow-hidden rounded-2xl border border-neutral-200 transition-all hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-lg dark:border-neutral-800 dark:hover:border-amber-700"
  >
    {/* Mini document page — title + a snippet of the text */}
    <div className="relative h-52 overflow-hidden bg-neutral-100 px-6 pt-5 dark:bg-neutral-800/60">
      <div className="h-full overflow-hidden rounded-t-md bg-white px-4 pt-3 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="h-2.5 w-2.5 rounded-full bg-linear-to-br from-amber-500 to-orange-600" />
          <span className="text-[9px] text-neutral-400">Page 1</span>
        </div>
        <p className="mt-2 truncate border-b border-neutral-200 pb-1.5 text-center text-[11px] font-bold text-neutral-900">
          {c.title}
        </p>
        <p className="mt-2 text-[9px] leading-[1.6] text-neutral-500">
          {c.preview}
        </p>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-neutral-100 dark:from-neutral-800/90" />
    </div>
    {/* Footer strip */}
    <div className="p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-base dark:bg-amber-950/50">
          📄
        </span>
        <Badge status={c.status} />
      </div>
      <p className="mt-2 truncate font-semibold">{c.title}</p>
      <div className="mt-1 flex items-center justify-between text-xs text-neutral-400">
        <span>
          {c.date}
          {c.signedAt && ` · signed ${c.signedAt}`}
        </span>
        {c.sigTotal > 0 && (
          <span
            title={`${c.sigSigned} of ${c.sigTotal} signatures collected`}
            className={
              c.sigSigned >= c.sigTotal
                ? "font-medium text-green-600 dark:text-green-400"
                : "text-neutral-400"
            }
          >
            ✍ {c.sigSigned}/{c.sigTotal}
          </span>
        )}
      </div>
      {c.clientName && (
        <p className="mt-0.5 truncate text-xs text-neutral-500">{c.clientName}</p>
      )}
    </div>
  </Link>
  );
}

export function BusinessDashboard(props: {
  channelId: string;
  channelName: string;
  handle: string;
  bookingEnabled: boolean;
  hasSignature: boolean;
  templates: PickerTemplate[];
  contracts: ContractRow[];
  services: Service[];
  bookings: BookingRow[];
  quotes: QuoteRow[];
  invoices: InvoiceRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams?.get("tab") ?? "overview";
  const [signatureModal, setSignatureModal] = useState(!props.hasSignature);
  const [firstVisitGuide, dismissFirstVisitGuide] = useFirstVisit("cf:tour:do-biz:v1");
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideSeen, setGuideSeen] = useState(false);
  // The signature modal takes the true first visit; the guide follows.
  const showGuide = (firstVisitGuide && !guideSeen && props.hasSignature) || guideOpen;
  const [templateModal, setTemplateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setTab = (t: string) => {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    if (t === "overview") next.delete("tab");
    else next.set("tab", t);
    router.replace(`?${next.toString()}`, { scroll: false });
  };

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return null;
      }
      router.refresh();
      return data as Record<string, unknown>;
    } finally {
      setBusy(false);
    }
  }

  // The Maltivas flow: pick a template → contract is created immediately →
  // land in the editor.
  async function createContract(templateId: string | null) {
    setCreating(true);
    try {
      const tpl = props.templates.find((t) => t.id === templateId);
      const data = await call("/api/studio/contracts", "POST", {
        channelId: props.channelId,
        title: tpl?.name ?? "Untitled contract",
        ...(templateId ? { templateId } : {}),
      });
      const contract = data?.contract as { id?: string } | undefined;
      if (contract?.id) {
        router.push(`/studio/channel/${props.channelId}/business/contracts/${contract.id}`);
      }
    } finally {
      setCreating(false);
      setTemplateModal(false);
    }
  }

  const stats = {
    pendingBookings: props.bookings.filter((b) => b.status === "PENDING").length,
    activeQuotes: props.quotes.filter((q) => ["sent", "viewed"].includes(q.status)).length,
    acceptedQuotes: props.quotes.filter((q) => q.status === "accepted").length,
    signedContracts: props.contracts.filter((c) => c.status === "SIGNED").length,
    paidInvoices: props.invoices.filter((i) => i.status === "paid").length,
    paidCents: props.invoices
      .filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + i.amountCents, 0),
  };

  const TABS = [
    ["overview", "Overview"],
    ["bookings", `Bookings (${props.bookings.length})`],
    ["quotes", `Quotes (${props.quotes.length})`],
    ["contracts", `Contracts (${props.contracts.length})`],
    ["invoices", `Invoices (${props.invoices.length})`],
  ] as const;

  const newButton =
    "rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500 disabled:opacity-50";

  return (
    <div className="mt-6">
      <SignatureSetupModal
        open={signatureModal}
        channelId={props.channelId}
        creatorName={props.channelName}
        onSaved={() => {
          setSignatureModal(false);
          router.refresh();
        }}
        onClose={() => setSignatureModal(false)}
      />
      <FeatureTour
        open={showGuide}
        title="Do-Biz guide"
        steps={DOBIZ_TOUR}
        onClose={() => {
          setGuideOpen(false);
          setGuideSeen(true);
          dismissFirstVisitGuide();
        }}
      />
      <TemplateModalCF
        open={templateModal}
        templates={props.templates}
        creating={creating}
        onSelect={(id) => void createContract(id)}
        onBlank={() => void createContract(null)}
        onClose={() => setTemplateModal(false)}
      />

      {/* Tab row */}
      <div
        data-tour="biz-tabs"
        className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-900"
      >
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? "bg-linear-to-r from-amber-500 to-orange-600 text-white shadow-sm"
                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => setGuideOpen(true)}
          title="How Do-Biz works"
          className="ml-auto whitespace-nowrap rounded-lg px-3 py-2 text-sm text-neutral-500 hover:text-amber-700 dark:hover:text-amber-400"
        >
          ✨ Guide
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {/* ─── Overview ─── */}
      {tab === "overview" && (
        <div className="mt-8 space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">Business overview</h2>
            <button
              data-tour="biz-create"
              onClick={() => setTemplateModal(true)}
              className={newButton}
            >
              ✍️ Create agreement
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Booking requests",
                value: props.bookings.length,
                sub: `${stats.pendingBookings} pending`,
              },
              {
                label: "Active quotes",
                value: stats.activeQuotes,
                sub: `${stats.acceptedQuotes} accepted`,
              },
              {
                label: "Contracts",
                value: props.contracts.length,
                sub: `${stats.signedContracts} signed`,
              },
              {
                label: "Revenue (invoiced)",
                value: money(stats.paidCents),
                sub: `${stats.paidInvoices} paid invoices`,
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-neutral-200 p-5 transition-all hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md dark:border-neutral-800 dark:hover:border-amber-700"
              >
                <p className="text-sm text-neutral-500">{s.label}</p>
                <p className="mt-1 text-2xl font-semibold">{s.value}</p>
                <p className="text-xs text-neutral-400">{s.sub}</p>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800">
            <h3 className="border-b border-neutral-100 px-5 py-4 text-sm font-semibold dark:border-neutral-900">
              Recent activity
            </h3>
            <div className="p-5">
              {props.contracts.length === 0 && props.bookings.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  Nothing yet — create an agreement or turn on bookings.
                </p>
              ) : (
                <ol className="space-y-2 text-sm">
                  {props.contracts.slice(0, 6).map((c) => (
                    <li key={c.id} className="flex items-baseline justify-between gap-3">
                      <Link
                        href={`/studio/channel/${props.channelId}/business/contracts/${c.id}`}
                        className="min-w-0 flex-1 truncate hover:underline"
                      >
                        {c.contractNumber} — {c.title}
                        {c.lastActivity && (
                          <span className="ml-2 text-xs text-neutral-400">
                            {c.lastActivity}
                          </span>
                        )}
                      </Link>
                      <Badge status={c.status} />
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>

          {/* Recent activity — the latest agreements as document cards */}
          {props.contracts.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold tracking-tight">Recent activity</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {props.contracts.slice(0, 4).map((c) => (
                  <ContractCard key={c.id} c={c} channelId={props.channelId} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Bookings ─── */}
      {tab === "bookings" && (
        <BookingsPane
          {...props}
          busy={busy}
          call={call}
        />
      )}

      {/* ─── Quotes ─── */}
      {tab === "quotes" && (
        <QuotesPane
          channelId={props.channelId}
          quotes={props.quotes}
          busy={busy}
          call={call}
        />
      )}

      {/* ─── Contracts ─── */}
      {tab === "contracts" && (
        <div className="mt-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">Contracts</h2>
            <button
              data-tour="biz-create"
              onClick={() => setTemplateModal(true)}
              className={newButton}
            >
              ✍️ Create contract
            </button>
          </div>
          {props.contracts.length === 0 && (
            <div className="rounded-2xl border border-neutral-200 p-8 text-center dark:border-neutral-800">
              <p className="text-4xl">📄</p>
              <h3 className="mt-3 font-semibold">No contracts yet</h3>
              <p className="text-sm text-neutral-500">
                Pick a template and send your first agreement.
              </p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {props.contracts.map((c) => (
              <ContractCard key={c.id} c={c} channelId={props.channelId} />
            ))}
          </div>
        </div>
      )}

      {/* ─── Invoices ─── */}
      {tab === "invoices" && (
        <InvoicesPane
          channelId={props.channelId}
          invoices={props.invoices}
          busy={busy}
          call={call}
        />
      )}
    </div>
  );
}

/* ───────────────────────── Bookings pane ───────────────────────── */

function BookingsPane({
  channelId,
  handle,
  bookingEnabled,
  services,
  bookings,
  busy,
  call,
}: {
  channelId: string;
  handle: string;
  bookingEnabled: boolean;
  services: Service[];
  bookings: BookingRow[];
  busy: boolean;
  call: (url: string, method: string, body?: unknown) => Promise<Record<string, unknown> | null>;
}) {
  const [sub, setSub] = useState<"services" | "requests">("services");
  const [deciding, setDeciding] = useState<{ id: string; action: "accept" | "decline" } | null>(
    null,
  );
  const [note, setNote] = useState("");
  const [quoting, setQuoting] = useState<BookingRow | null>(null);
  const [quoteTitle, setQuoteTitle] = useState("");
  const [quoteAmount, setQuoteAmount] = useState("");

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Bookings</h2>
        <button
          disabled={busy}
          onClick={() =>
            void call("/api/studio/bookings", "PATCH", {
              channelId,
              action: bookingEnabled ? "disable" : "enable",
            })
          }
          className={
            bookingEnabled
              ? "rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:border-red-400 hover:text-red-600 dark:border-neutral-700 dark:text-neutral-300"
              : "rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
          }
        >
          {bookingEnabled ? "Stop taking bookings" : "Start taking bookings"}
        </button>
      </div>
      {bookingEnabled && (
        <p className="mt-1 text-xs text-neutral-500">
          Public booking page:{" "}
          <Link href={`/@${handle}/book`} className="underline">
            /@{handle}/book
          </Link>
        </p>
      )}

      <div className="mt-4 flex gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-900 sm:w-fit">
        {(
          [
            ["services", "Create bookings"],
            ["requests", `Booking requests (${bookings.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSub(key)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ${
              sub === key
                ? "bg-linear-to-r from-amber-500 to-orange-600 text-white shadow-sm"
                : "text-neutral-600 dark:text-neutral-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {sub === "services" && (
        <ServicesEditor channelId={channelId} services={services} busy={busy} />
      )}

      {sub === "requests" && (
        <div className="mt-4 space-y-4">
          {bookings.length === 0 && (
            <p className="rounded-xl border border-dashed border-neutral-300 p-6 text-sm text-neutral-500 dark:border-neutral-700">
              No requests yet — share your booking page.
            </p>
          )}
          {bookings.map((b) => (
            <div
              key={b.id}
              className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{b.requesterName}</h3>
                    <Badge status={b.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {b.requesterEmail}
                    {b.organization && ` · ${b.organization}`}
                    {b.eventDate && ` · ${b.eventDate}`}
                    {b.location && ` · ${b.location}`}
                    {b.budgetCents !== null && ` · ${money(b.budgetCents)}`}
                    {` · ${b.date}`}
                  </p>
                </div>
                {b.status === "PENDING" && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      disabled={busy}
                      onClick={() => {
                        setQuoting(b);
                        setQuoteTitle(b.organization ? `Engagement — ${b.organization}` : "Engagement");
                        setQuoteAmount(b.budgetCents ? String(b.budgetCents / 100) : "");
                      }}
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:border-amber-500 hover:text-amber-700 dark:border-neutral-700 dark:hover:text-amber-400"
                    >
                      Send quote
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setNote("");
                        setDeciding({ id: b.id, action: "accept" });
                      }}
                      className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
                    >
                      Accept → contract
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        setNote("");
                        setDeciding({ id: b.id, action: "decline" });
                      }}
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:border-red-400 dark:border-neutral-700 dark:text-red-400"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                {b.message}
              </p>
              {b.decisionNote && (
                <p className="mt-2 text-xs italic text-neutral-500">Your note: {b.decisionNote}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quote-from-request dialog */}
      {quoting && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900">
            <h3 className="text-lg font-semibold">Quote for {quoting.requesterName}</h3>
            <input
              value={quoteTitle}
              onChange={(e) => setQuoteTitle(e.target.value)}
              placeholder="What the quote covers"
              className="mt-4 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-950"
            />
            <div className="mt-2 flex items-center gap-1 rounded-lg border border-neutral-300 px-3 dark:border-neutral-700">
              <span className="text-sm text-neutral-500">$</span>
              <input
                value={quoteAmount}
                onChange={(e) => setQuoteAmount(e.target.value)}
                type="number"
                min={1}
                placeholder="amount"
                className="w-full bg-transparent py-2 text-sm outline-none"
              />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setQuoting(null)}
                className="text-sm text-neutral-500 hover:underline"
              >
                Cancel
              </button>
              <button
                disabled={busy || !quoteTitle.trim() || !quoteAmount}
                onClick={() => {
                  const b = quoting;
                  setQuoting(null);
                  void call("/api/studio/quotes", "POST", {
                    channelId,
                    bookingRequestId: b.id,
                    clientName: b.requesterName,
                    clientEmail: b.requesterEmail,
                    title: quoteTitle,
                    description: b.message.slice(0, 4000),
                    amountCents: Math.round(Number(quoteAmount) * 100),
                  }).then((data) => {
                    const q = data?.quote as { id?: string } | undefined;
                    if (q?.id) {
                      void call("/api/studio/quotes", "PATCH", {
                        channelId,
                        quoteId: q.id,
                        action: "send",
                      });
                    }
                  });
                }}
                className="rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500 disabled:opacity-50"
              >
                Create & send quote
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deciding !== null}
        title={deciding?.action === "accept" ? "Accept this booking?" : "Decline this booking?"}
        body={
          deciding?.action === "accept"
            ? "A contract draft is created from the request — open it under Contracts, then sign & send. The requester is notified by email."
            : "The requester is notified by email."
        }
        confirmLabel={deciding?.action === "accept" ? "Accept" : "Decline"}
        destructive={deciding?.action === "decline"}
        onConfirm={() => {
          const d = deciding;
          setDeciding(null);
          if (d) {
            void call("/api/studio/bookings", "PATCH", {
              channelId,
              action: d.action,
              requestId: d.id,
              ...(note.trim() ? { decisionNote: note.trim() } : {}),
            });
          }
        }}
        onCancel={() => setDeciding(null)}
      />
      {deciding && (
        <div className="fixed inset-x-0 bottom-6 z-[80] mx-auto w-full max-w-md px-4">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            placeholder="Optional note to the requester…"
            className="w-full rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm shadow-lg outline-none dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Quotes pane ───────────────────────── */

function QuotesPane({
  channelId,
  quotes,
  busy,
  call,
}: {
  channelId: string;
  quotes: QuoteRow[];
  busy: boolean;
  call: (url: string, method: string, body?: unknown) => Promise<Record<string, unknown> | null>;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  return (
    <div className="mt-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Quotes</h2>
        <Link
          href={`/studio/channel/${channelId}/business/quotes/new`}
          className="rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500"
        >
          📄 Create quote
        </Link>
      </div>

      {quotes.length === 0 && (
        <div className="rounded-2xl border border-neutral-200 p-8 text-center dark:border-neutral-800">
          <p className="text-4xl">📄</p>
          <h3 className="mt-3 font-semibold">No quotes yet</h3>
          <p className="text-sm text-neutral-500">
            Quote a booking request, or create one from scratch — accepting
            turns it into a contract.
          </p>
        </div>
      )}
      {quotes.map((q) => (
        <div
          key={q.id}
          className="rounded-2xl border border-neutral-200 p-5 transition-all hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md dark:border-neutral-800 dark:hover:border-amber-700"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-xs text-neutral-400"># {q.quoteNumber}</p>
              <Link
                href={`/studio/channel/${channelId}/business/quotes/${q.id}`}
                className="mt-0.5 block font-semibold hover:text-amber-700 dark:hover:text-amber-400"
              >
                {q.title}
              </Link>
              <p className="text-sm text-neutral-500">{q.clientName}</p>
              <p className="mt-1 text-xs text-neutral-400">
                {q.date}
                {q.expiresAt && ` · expires ${q.expiresAt}`}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <Badge status={q.status} />
              <p className="font-semibold">{money(q.amountCents)}</p>
              <div className="flex gap-2">
                {q.status === "draft" && (
                  <>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void call("/api/studio/quotes", "PATCH", {
                          channelId,
                          quoteId: q.id,
                          action: "send",
                        })
                      }
                      className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
                    >
                      Send
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void call("/api/studio/quotes", "PATCH", {
                          channelId,
                          quoteId: q.id,
                          action: "delete",
                        })
                      }
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:border-red-400 dark:border-neutral-700 dark:text-red-400"
                    >
                      Delete
                    </button>
                  </>
                )}
                {["sent", "viewed"].includes(q.status) && (
                  <button
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(`${window.location.origin}/quote/${q.token}`)
                        .then(() => {
                          setCopied(q.id);
                          setTimeout(() => setCopied(null), 2000);
                        });
                    }}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:border-amber-500 hover:text-amber-700 dark:border-neutral-700 dark:hover:text-amber-400"
                  >
                    {copied === q.id ? "Copied ✓" : "Copy link"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────── Invoices pane ───────────────────────── */

function InvoicesPane({
  channelId,
  invoices,
  busy,
  call,
}: {
  channelId: string;
  invoices: InvoiceRow[];
  busy: boolean;
  call: (url: string, method: string, body?: unknown) => Promise<Record<string, unknown> | null>;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  return (
    <div className="mt-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Invoices</h2>
        <Link
          href={`/studio/channel/${channelId}/business/invoices/new`}
          className="rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500"
        >
          🧾 Create invoice
        </Link>
      </div>

      {invoices.length === 0 && (
        <div className="rounded-2xl border border-neutral-200 p-8 text-center dark:border-neutral-800">
          <p className="text-4xl">🧾</p>
          <h3 className="mt-3 font-semibold">No invoices yet</h3>
          <p className="text-sm text-neutral-500">
            Invoice a signed agreement — sent by email, marked paid on receipt.
          </p>
        </div>
      )}
      {invoices.map((inv) => (
        <div
          key={inv.id}
          className="rounded-2xl border border-neutral-200 p-5 transition-all hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md dark:border-neutral-800 dark:hover:border-amber-700"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-xs text-neutral-400"># {inv.invoiceNumber}</p>
              <Link
                href={`/studio/channel/${channelId}/business/invoices/${inv.id}`}
                className="mt-0.5 block font-semibold hover:text-amber-700 dark:hover:text-amber-400"
              >
                {inv.title}
              </Link>
              <p className="text-sm text-neutral-500">{inv.clientName}</p>
              <p className="mt-1 text-xs text-neutral-400">
                {inv.date}
                {inv.dueAt && ` · due ${inv.dueAt}`}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <Badge status={inv.status} />
              <p className="font-semibold">{money(inv.amountCents)}</p>
              <div className="flex flex-wrap justify-end gap-2">
                {inv.status === "draft" && (
                  <>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void call("/api/studio/invoices", "PATCH", {
                          channelId,
                          invoiceId: inv.id,
                          action: "send",
                        })
                      }
                      className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
                    >
                      Send
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void call("/api/studio/invoices", "PATCH", {
                          channelId,
                          invoiceId: inv.id,
                          action: "delete",
                        })
                      }
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:border-red-400 dark:border-neutral-700 dark:text-red-400"
                    >
                      Delete
                    </button>
                  </>
                )}
                {["sent", "viewed"].includes(inv.status) && (
                  <>
                    <button
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(`${window.location.origin}/invoice/${inv.token}`)
                          .then(() => {
                            setCopied(inv.id);
                            setTimeout(() => setCopied(null), 2000);
                          });
                      }}
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:border-amber-500 hover:text-amber-700 dark:border-neutral-700 dark:hover:text-amber-400"
                    >
                      {copied === inv.id ? "Copied ✓" : "Copy link"}
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void call("/api/studio/invoices", "PATCH", {
                          channelId,
                          invoiceId: inv.id,
                          action: "markPaid",
                        })
                      }
                      className="rounded-lg border border-green-500 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/30"
                    >
                      Mark paid
                    </button>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void call("/api/studio/invoices", "PATCH", {
                          channelId,
                          invoiceId: inv.id,
                          action: "void",
                        })
                      }
                      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-500 hover:border-red-400 hover:text-red-600 dark:border-neutral-700"
                    >
                      Void
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
