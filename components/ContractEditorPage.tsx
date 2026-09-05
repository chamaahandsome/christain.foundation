"use client";

// The Do-Biz contract editor layout, CF-skinned: header bar (back, inline
// title, status dot, save pill, Save / Send), paper canvas with a lock
// banner once sent, and a details sidebar (client, value, signature,
// activity). Highlighted data-field spans in the document are the fill-ins.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { DocEditor } from "@/components/DocEditor";
import { SignatureSetupModal } from "@/components/SignatureSetupModal";
import { ImageUploadDialog } from "@/components/ImageUploadDialog";
import { FeatureTour, useFirstVisit, type TourStep } from "@/components/FeatureTour";
import {
  countSignatureFields,
  countUnassignedClientChips,
  extractRecipientFields,
  getUniqueRecipients,
  signatureBlockHtml,
  substituteSignatureFields,
} from "@/lib/contract-fields";

interface Activity {
  id: string;
  description: string;
  date: string;
}

interface ContractData {
  id: string;
  contractNumber: string;
  title: string;
  clientName: string;
  clientEmail: string;
  clientCompany: string | null;
  amountCents: number | null;
  status: string;
  content: string;
  logoUrl: string | null;
  signLink: string | null;
  activities: Activity[];
}

// The Maltivas editor walkthrough, CF-shaped.
const EDITOR_TOUR: TourStep[] = [
  {
    icon: "📝",
    title: "Name your contract",
    body: "The title at the top is editable in place — it names the signing email and the signed record.",
    anchor: '[data-tour="editor-title"]',
  },
  {
    icon: "📄",
    title: "Write on the paper",
    body: "The canvas is the agreement itself. The floating toolbar formats text; the + button inserts tables, images, input fields, and signature fields.",
    anchor: '[data-tour="editor-toolbar"]',
  },
  {
    icon: "🔶",
    title: "Click any highlighted chip",
    body: "Amber chips are fill-ins. Click one to set its value now — or flip it to 'Recipient (signer)' and the other party fills it in on the signing page.",
    anchor: '.tiptap [data-field]',
  },
  {
    icon: "✍️",
    title: "Signature fields route signers",
    body: "Place a signature field where each party signs. Assign a recipient's name and email — every unique email gets its own signing link.",
    anchor: '.tiptap [data-signature-field]',
  },
  {
    icon: "👥",
    title: "Recipients update live",
    body: "The sidebar shows every signer the document will route to, and warns when a signature field has no email or the client email is missing.",
    anchor: '[data-tour="editor-recipients"]',
  },
  {
    icon: "📨",
    title: "Send for signature",
    body: "Send emails every recipient a secure signing link; your stored signature signs for you. Track viewed / partially signed / signed from the status pill.",
    anchor: '[data-tour="editor-send"]',
  },
];

const STATUS_DOT: Record<string, string> = {
  DRAFT: "bg-neutral-400",
  SENT: "bg-sky-400",
  VIEWED: "bg-amber-400",
  PARTIALLY_SIGNED: "bg-violet-400",
  SIGNED: "bg-green-500",
  DECLINED: "bg-red-500",
  EXPIRED: "bg-neutral-400",
  CANCELLED: "bg-neutral-400",
};

export interface LinkableInvoice {
  id: string;
  invoiceNumber: string;
  title: string;
  amountCents: number;
  status: string;
  contractId: string | null;
}

export function ContractEditorPage({
  channelId,
  channelName,
  hasSignature,
  signatureImage,
  contract,
  invoices = [],
  logoHistory = [],
}: {
  channelId: string;
  channelName: string;
  hasSignature: boolean;
  signatureImage: string | null;
  contract: ContractData;
  invoices?: LinkableInvoice[];
  logoHistory?: string[];
}) {
  const router = useRouter();
  const editable = contract.status === "DRAFT";
  const [title, setTitle] = useState(contract.title);
  const [clientName, setClientName] = useState(contract.clientName);
  const [clientEmail, setClientEmail] = useState(contract.clientEmail);
  const [clientCompany, setClientCompany] = useState(contract.clientCompany ?? "");
  const [amount, setAmount] = useState(
    contract.amountCents !== null ? String(contract.amountCents / 100) : "",
  );
  const [content, setContent] = useState(contract.content);
  const [logoUrl, setLogoUrl] = useState(contract.logoUrl);
  const [logoDialog, setLogoDialog] = useState(false);
  const [recentLogos, setRecentLogos] = useState(logoHistory);

  // Chosen logos ride the contract AND save to the profile (used for all
  // new contracts, invoices, and quotes — the Maltivas logoHistory flow).
  function applyLogo(url: string | null) {
    setLogoUrl(url);
    dirty.current = true;
    setSaveState("unsaved");
    if (url) setRecentLogos((h) => [url, ...h.filter((u) => u !== url)].slice(0, 3));
    void fetch("/api/studio/business/logo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channelId, logoUrl: url }),
    }).catch(() => {});
  }
  const [saveState, setSaveState] = useState<"saved" | "unsaved" | "saving">("saved");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [signatureModal, setSignatureModal] = useState(false);
  const [linkedInvoiceId, setLinkedInvoiceId] = useState(
    invoices.find((inv) => inv.contractId === contract.id)?.id ?? "",
  );
  const [linking, setLinking] = useState(false);
  const [firstVisitTour, dismissFirstVisitTour] = useFirstVisit("cf:tour:contract-editor:v1");
  const [tourOpen, setTourOpen] = useState(false);
  const [tourSeen, setTourSeen] = useState(false);
  const showTour = (editable && firstVisitTour && !tourSeen) || tourOpen;

  async function linkInvoice(invoiceId: string) {
    const prev = linkedInvoiceId;
    setLinkedInvoiceId(invoiceId);
    setLinking(true);
    try {
      const res = await fetch("/api/studio/invoices", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channelId,
          invoiceId: invoiceId || prev,
          action: "link",
          contractId: invoiceId ? contract.id : null,
        }),
      });
      if (!res.ok) setLinkedInvoiceId(prev);
    } finally {
      setLinking(false);
    }
  }
  const [preview, setPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const dirty = useRef(false);

  const markDirty = () => {
    dirty.current = true;
    setSaveState("unsaved");
  };

  const save = useCallback(async (): Promise<boolean> => {
    if (!dirty.current) return true;
    setSaveState("saving");
    setError(null);
    const res = await fetch(`/api/studio/contracts/${contract.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "edit",
        title,
        clientName,
        clientEmail,
        clientCompany: clientCompany.trim() || null,
        amountCents: amount ? Math.round(Number(amount) * 100) : null,
        content,
        logoUrl,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? `Save failed (${res.status})`);
      setSaveState("unsaved");
      return false;
    }
    dirty.current = false;
    setSaveState("saved");
    return true;
  }, [contract.id, title, clientName, clientEmail, clientCompany, amount, content, logoUrl]);

  // Autosave, the Maltivas cadence: debounce edits.
  useEffect(() => {
    if (!editable || !dirty.current) return;
    const timer = setTimeout(() => void save(), 2500);
    return () => clearTimeout(timer);
  }, [editable, save, title, clientName, clientEmail, clientCompany, amount, content, logoUrl]);

  // Recipients-panel facts, recomputed as the document changes (the
  // Maltivas warnings: unassigned signature fields, missing recipient).
  const sigFields = countSignatureFields(content);
  const recipientFields = extractRecipientFields(content);
  const hasClientEmail = clientEmail.includes("@");
  const assignedRecipients = getUniqueRecipients(content);
  const unassignedChips = countUnassignedClientChips(content);
  // The default clientEmail recipient covers unassigned chips and
  // chip-less documents.
  const needsDefault = assignedRecipients.length === 0 || unassignedChips > 0;
  const totalRecipients =
    assignedRecipients.length + (needsDefault && hasClientEmail ? 1 : 0);
  const letterhead = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <div className="border-b-2 border-neutral-200 pb-4 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoUrl} alt="" className="mx-auto h-20 object-contain" />
    </div>
  ) : null;

  // What the client will see: your chip becomes your real signature.
  const previewHtml =
    hasSignature && signatureImage
      ? substituteSignatureFields(
          content,
          "creator",
          signatureBlockHtml({
            signature: signatureImage,
            signerName: channelName,
            signedAt: new Date(),
          }),
        )
      : content;

  const sendDisabledReason = !hasSignature
    ? "Create your signature first"
    : needsDefault && !hasClientEmail
      ? unassignedChips > 0
        ? `${unassignedChips} signature field${unassignedChips > 1 ? "s have" : " has"} no email assigned — assign them, or fill in the client email`
        : "Add a signature field with an email, or fill in the client email"
      : null;

  async function send() {
    if (!(await save())) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/studio/contracts/${contract.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "send" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Send failed (${res.status})`);
        return;
      }
      if (data.token) {
        void navigator.clipboard
          .writeText(`${window.location.origin}/sign/${data.token}`)
          .catch(() => {});
      }
      router.refresh();
    } finally {
      setSending(false);
    }
  }

  const input =
    "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-amber-600";

  return (
    <div className="mx-[calc(50%-50vw)] mt-4 px-4 sm:px-6 lg:px-10">
      <FeatureTour
        open={showTour}
        title="Contract editor"
        steps={EDITOR_TOUR}
        onClose={() => {
          setTourOpen(false);
          setTourSeen(true);
          dismissFirstVisitTour();
        }}
      />
      <ImageUploadDialog
        open={logoDialog}
        title="Contract logo"
        channelId={channelId}
        aspect={1}
        allowRemove={false}
        onCancel={() => setLogoDialog(false)}
        onDone={(url) => {
          setLogoDialog(false);
          if (url) applyLogo(url);
        }}
      />
      <SignatureSetupModal
        open={signatureModal}
        channelId={channelId}
        creatorName={channelName}
        onSaved={() => {
          setSignatureModal(false);
          router.refresh();
        }}
        onClose={() => setSignatureModal(false)}
      />

      {/* Header bar */}
      <div className="sticky top-14 z-30 -mx-4 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10 dark:border-neutral-800 dark:bg-neutral-950/95">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3">
          <Link
            href={`/studio/channel/${channelId}/business?tab=contracts`}
            className="shrink-0 rounded-lg px-2 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            ← Back
          </Link>
          <input
            data-tour="editor-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              markDirty();
            }}
            disabled={!editable}
            placeholder="Untitled contract"
            className="min-w-0 flex-1 bg-transparent text-lg font-semibold outline-none placeholder:text-neutral-400"
          />
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            <span
              className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[contract.status] ?? "bg-neutral-400"}`}
            />
            {contract.status.toLowerCase()}
          </span>
          {editable && (
            <span
              className={`shrink-0 text-xs ${
                saveState === "saving"
                  ? "text-sky-600"
                  : saveState === "unsaved"
                    ? "text-amber-600"
                    : "text-neutral-400"
              }`}
            >
              {saveState === "saving"
                ? "Saving…"
                : saveState === "unsaved"
                  ? "Unsaved changes"
                  : "Saved"}
            </span>
          )}
          {editable && (
            <>
              <button
                onClick={() => setTourOpen(true)}
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                ✨ {firstVisitTour || !tourSeen ? "Show tour" : "Replay tour"}
              </button>
              <button
                onClick={() => setPreview(true)}
                className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:border-amber-500 hover:text-amber-700 dark:border-neutral-700 dark:hover:text-amber-400"
              >
                👁 Preview
              </button>
              <button
                onClick={() => void save()}
                className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:border-amber-500 hover:text-amber-700 dark:border-neutral-700 dark:hover:text-amber-400"
              >
                Save
              </button>
              <button
                data-tour="editor-send"
                onClick={() => void send()}
                disabled={!!sendDisabledReason || sending}
                title={sendDisabledReason ?? "Sign with your stored signature and email the signing link"}
                className="shrink-0 rounded-lg bg-linear-to-r from-amber-500 to-orange-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500 disabled:opacity-50"
              >
                {sending ? "Sending…" : "Send to client"}
              </button>
            </>
          )}
          {!editable && contract.signLink && (
            <button
              onClick={() => {
                void navigator.clipboard.writeText(contract.signLink!).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                });
              }}
              className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:border-amber-500 hover:text-amber-700 dark:border-neutral-700 dark:hover:text-amber-400"
            >
              {copied ? "Copied ✓" : "Copy signing link"}
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      <div className="mx-auto mt-6 flex max-w-[1500px] flex-col gap-6 lg:flex-row">
        {/* Paper canvas */}
        <div className="min-w-0 flex-1">
          {!editable && (
            <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
              <p className="font-medium">
                This contract is {contract.status.toLowerCase()} — editing is locked.
              </p>
              <p className="text-sky-800/80 dark:text-sky-300/80">
                The recipient already has the signing link. Create a new
                contract if anything needs to change.
              </p>
            </div>
          )}
          {editable ? (
            <DocEditor
              value={content}
              onChange={(html) => {
                setContent(html);
                markDirty();
              }}
              channelId={channelId}
              placeholder="The agreement itself — chips are fill-ins; click one to configure it"
            />
          ) : (
            <div className="mx-auto max-w-[880px] rounded-[3px] border border-neutral-300/80 bg-white px-8 py-10 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_12px_32px_rgba(0,0,0,0.12)] sm:px-12 dark:border-neutral-600">
              {letterhead}
              <div
                className="prose-reader text-[15px] leading-7 text-neutral-900"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          )}
        </div>

        {/* Details sidebar */}
        <aside className="w-full shrink-0 space-y-4 lg:w-80">
          {editable && (
            <div
              data-tour="editor-recipients"
              className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Recipients</h3>
                <span className="text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
                  {totalRecipients} total
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {/* Sender row — your stored signature signs at send */}
                <div className="flex items-center gap-2.5 rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-700">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-amber-500 to-orange-600 text-xs font-bold text-white">
                    {channelName.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">{channelName}</p>
                    <p className="text-[11px] text-neutral-400">Sender · signs at send</p>
                  </div>
                  {hasSignature ? (
                    <span className="text-[11px] font-medium text-green-600 dark:text-green-400">✓</span>
                  ) : (
                    <span className="text-[11px] text-amber-600">no sig</span>
                  )}
                </div>
                {/* One row per assigned signature-field recipient */}
                {assignedRecipients.map((r) => (
                    <div
                      key={r.email}
                      className="flex items-center gap-2.5 rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-700"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                        {(r.name || r.email).slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{r.name}</p>
                        <p className="truncate text-[11px] text-neutral-400">{r.email}</p>
                      </div>
                    </div>
                ))}
                {/* Default client row (covers unassigned chips / no chips) */}
                {needsDefault && hasClientEmail && (
                  <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-neutral-300 px-3 py-2 dark:border-neutral-700">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-500 dark:bg-neutral-800">
                      {(clientName || clientEmail).slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">
                        {clientName || clientEmail}
                      </p>
                      <p className="truncate text-[11px] text-neutral-400">
                        {clientEmail} · default
                      </p>
                    </div>
                  </div>
                )}
                {/* Warnings — the Maltivas problem callouts */}
                {unassignedChips > 0 && !hasClientEmail && (
                  <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    ⚠ {unassignedChips} signature field
                    {unassignedChips > 1 ? "s have" : " has"} no email assigned —
                    click each chip to assign a recipient, or fill in the client
                    email below.
                  </p>
                )}
                {unassignedChips > 0 && hasClientEmail && (
                  <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs leading-5 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
                    {unassignedChips} unassigned signature field
                    {unassignedChips > 1 ? "s" : ""} go to {clientEmail}.
                  </p>
                )}
                {assignedRecipients.length === 0 && !hasClientEmail && (
                  <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                    ⚠ No recipient — add a signature field with an email, or
                    fill in the client email below.
                  </p>
                )}
                {sigFields.client === 0 && (
                  <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs leading-5 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400">
                    No client signature field in the document — add one from
                    the toolbar (+ → ✍️ Signature field) to place where they
                    sign.
                  </p>
                )}
                {recipientFields.length > 0 && (
                  <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300">
                    {recipientFields.length} field
                    {recipientFields.length > 1 ? "s" : ""} the signer fills in:{" "}
                    {recipientFields.map((f) => f.key.replace(/-/g, " ")).join(", ")}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
            <h3 className="text-sm font-semibold">Client information</h3>
            <div className="mt-3 space-y-2">
              <input
                value={clientName}
                onChange={(e) => {
                  setClientName(e.target.value);
                  markDirty();
                }}
                disabled={!editable}
                placeholder="Client's full name"
                className={input}
              />
              <input
                value={clientEmail}
                onChange={(e) => {
                  setClientEmail(e.target.value);
                  markDirty();
                }}
                disabled={!editable}
                type="email"
                placeholder="Client's email (signing link goes here)"
                className={input}
              />
              <input
                value={clientCompany}
                onChange={(e) => {
                  setClientCompany(e.target.value);
                  markDirty();
                }}
                disabled={!editable}
                placeholder="Company / church (optional)"
                className={input}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
            <h3 className="text-sm font-semibold">Contract value</h3>
            <div className="mt-3 flex items-center gap-1 rounded-lg border border-neutral-300 px-3 dark:border-neutral-700">
              <span className="text-sm text-neutral-500">$</span>
              <input
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  markDirty();
                }}
                disabled={!editable}
                type="number"
                min={0}
                placeholder="optional"
                className="w-full bg-transparent py-2 text-sm outline-none disabled:opacity-60"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
            <h3 className="text-sm font-semibold">Your signature</h3>
            {hasSignature && signatureImage ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={signatureImage}
                  alt="Your signature"
                  className="mt-2 h-12 rounded-lg border border-neutral-200 bg-white px-2 dark:border-neutral-700"
                />
                <p className="mt-1.5 text-xs text-green-600 dark:text-green-400">
                  ✓ Signs automatically when you send
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                No signature yet — it signs every contract you send.
              </p>
            )}
            <button
              onClick={() => setSignatureModal(true)}
              className="mt-2 text-xs text-neutral-500 underline-offset-2 hover:underline"
            >
              {hasSignature ? "Change signature" : "Create signature"}
            </button>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">🖼 Contract logo</h3>
              {logoUrl && (
                <span className="text-[11px] font-medium text-green-600 dark:text-green-400">
                  ✓ Saved to profile
                </span>
              )}
            </div>
            {recentLogos.length > 0 && (
              <>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
                  Recent logos (click to use)
                </p>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {recentLogos.map((url) => (
                    <button
                      key={url}
                      type="button"
                      disabled={!editable}
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
              </>
            )}
            {logoUrl ? (
              <div className="group relative mt-2 flex h-16 items-center justify-center rounded-lg border border-neutral-200 bg-white dark:border-neutral-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="Contract logo" className="h-12 object-contain" />
                {editable && (
                  <button
                    type="button"
                    onClick={() => applyLogo(null)}
                    title="Remove logo"
                    className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white group-hover:flex"
                  >
                    ✕
                  </button>
                )}
              </div>
            ) : (
              editable && (
                <button
                  type="button"
                  onClick={() => setLogoDialog(true)}
                  className="mt-2 w-full rounded-lg border border-dashed border-neutral-300 px-3 py-3 text-xs text-neutral-500 hover:border-amber-500 hover:text-amber-700 dark:border-neutral-700 dark:hover:text-amber-400"
                >
                  Upload a logo
                </button>
              )
            )}
            <p className="mt-1.5 text-[11px] leading-4 text-neutral-400">
              Used for all new contracts, invoices, and quotes. Square PNG or
              JPG works best.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
            <h3 className="text-sm font-semibold">🧾 Invoice</h3>
            <p className="mt-1 text-xs text-neutral-500">Link to invoice (optional)</p>
            <select
              value={linkedInvoiceId}
              disabled={linking || contract.status === "SIGNED"}
              onChange={(e) => void linkInvoice(e.target.value)}
              className="mt-2 w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-amber-500 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 [&>option]:dark:bg-neutral-900"
            >
              <option value="">No invoice linked</option>
              {invoices
                .filter((inv) => inv.status === "draft" || inv.contractId === contract.id)
                .map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNumber} · ${(inv.amountCents / 100).toLocaleString()} — {inv.title}
                  </option>
                ))}
            </select>
            <p className="mt-1.5 text-xs text-neutral-400">
              When linked, the invoice is emailed to the client automatically
              after the contract is signed.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
            <h3 className="text-sm font-semibold">Activity</h3>
            <ol className="mt-3 space-y-1.5 text-xs text-neutral-600 dark:text-neutral-400">
              {contract.activities.map((a) => (
                <li key={a.id} className="flex justify-between gap-3">
                  <span>{a.description}</span>
                  <span className="shrink-0 text-neutral-400">{a.date}</span>
                </li>
              ))}
            </ol>
          </div>

          <p className="text-xs text-neutral-400">
            {contract.contractNumber} · verify at /verify/{contract.id}
          </p>
        </aside>
      </div>

      {/* Preview — the document as the client will see it */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setPreview(false)}
        >
          <div
            className="my-8 w-full max-w-3xl rounded-2xl bg-white shadow-2xl dark:bg-neutral-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
              <h2 className="font-semibold">Preview — what {clientName || "the client"} sees</h2>
              <button
                onClick={() => setPreview(false)}
                className="rounded-md px-2 py-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <div className="rounded-[3px] border border-neutral-300/80 bg-white px-8 py-10 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_12px_32px_rgba(0,0,0,0.12)]">
                {letterhead}
                <div
                  className="prose-reader text-[15px] leading-7 text-neutral-900"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              </div>
              {recipientFields.length > 0 && (
                <p className="mt-3 text-xs text-neutral-500">
                  Blue chips are filled in by the signer on the signing page.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
