"use client";

// The Do-Biz contract editor layout, CF-skinned: header bar (back, inline
// title, status dot, save pill, Save / Send), paper canvas with a lock
// banner once sent, and a details sidebar (client, value, signature,
// activity). Highlighted data-field spans in the document are the fill-ins.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { RichEditor } from "@/components/RichEditor";
import { SignatureSetupModal } from "@/components/SignatureSetupModal";

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
  signLink: string | null;
  activities: Activity[];
}

const STATUS_DOT: Record<string, string> = {
  DRAFT: "bg-neutral-400",
  SENT: "bg-sky-400",
  VIEWED: "bg-amber-400",
  SIGNED: "bg-green-500",
  DECLINED: "bg-red-500",
  EXPIRED: "bg-neutral-400",
  CANCELLED: "bg-neutral-400",
};

export function ContractEditorPage({
  channelId,
  channelName,
  hasSignature,
  signatureImage,
  contract,
}: {
  channelId: string;
  channelName: string;
  hasSignature: boolean;
  signatureImage: string | null;
  contract: ContractData;
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
  const [saveState, setSaveState] = useState<"saved" | "unsaved" | "saving">("saved");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [signatureModal, setSignatureModal] = useState(false);
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
  }, [contract.id, title, clientName, clientEmail, clientCompany, amount, content]);

  // Autosave, the Maltivas cadence: debounce edits.
  useEffect(() => {
    if (!editable || !dirty.current) return;
    const timer = setTimeout(() => void save(), 2500);
    return () => clearTimeout(timer);
  }, [editable, save, title, clientName, clientEmail, clientCompany, amount, content]);

  const sendDisabledReason = !hasSignature
    ? "Create your signature first"
    : !clientEmail.includes("@")
      ? "Add the client's email"
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
    <div className="mt-4">
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
      <div className="sticky top-14 z-30 -mx-4 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/studio/channel/${channelId}/business?tab=contracts`}
            className="shrink-0 rounded-lg px-2 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            ← Back
          </Link>
          <input
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
                onClick={() => void save()}
                className="shrink-0 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:border-amber-500 hover:text-amber-700 dark:border-neutral-700 dark:hover:text-amber-400"
              >
                Save
              </button>
              <button
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

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
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
            <RichEditor
              value={content}
              onChange={(html) => {
                setContent(html);
                markDirty();
              }}
              minHeight={480}
              channelId={channelId}
              placeholder="The agreement itself — highlighted sections are fill-ins"
            />
          ) : (
            <div
              className="prose-reader rounded-2xl border border-neutral-200 bg-white p-6 text-[15px] leading-7 dark:border-neutral-800 dark:bg-neutral-900"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          )}
        </div>

        {/* Details sidebar */}
        <aside className="w-full shrink-0 space-y-4 lg:w-80">
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
    </div>
  );
}
