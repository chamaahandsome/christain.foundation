"use client";

// The counterparty's signing experience (the Maltivas /sign flow, CF-
// skinned): a progress bar up top, the document with ONLY this signer's
// areas interactive — fill-in chips open a bubble, signature chips open
// the Type/Draw dialog — and a Finalize bar with consent, submit, and
// decline. Everything else in the document reads as ordinary text.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SignaturePad } from "@/components/SignaturePad";
import { PenIcon } from "@/components/icons";

interface Field {
  key: string;
  label: string;
}

export function SigningExperience({
  token,
  contractId,
  signerName,
  consentText,
  html,
  fields,
  myChips,
  partiesSigned,
  partiesTotal,
}: {
  token: string;
  contractId: string;
  signerName: string;
  consentText: string;
  /** prepared signing HTML (data-sign-input / data-sign-here / data-sign-pending) */
  html: string;
  fields: Field[];
  myChips: number;
  partiesSigned: number;
  partiesTotal: number;
}) {
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [signature, setSignature] = useState<{
    type: "typed" | "drawn";
    data: string;
    name: string;
  } | null>(null);
  const [consent, setConsent] = useState(false);
  const [bubble, setBubble] = useState<{
    key: string;
    label: string;
    x: number;
    y: number;
  } | null>(null);
  const [signDialog, setSignDialog] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"signed" | "partial" | "declined" | null>(null);
  const docRef = useRef<HTMLDivElement>(null);

  const filledCount = fields.filter((f) => fieldValues[f.key]?.trim()).length;
  const signatureDone = signature !== null;
  const readyToSubmit =
    signatureDone && filledCount === fields.length && consent && !busy;

  // Reflect state into the document chips (the HTML itself is static).
  useEffect(() => {
    const root = docRef.current;
    if (!root) return;
    for (const el of root.querySelectorAll<HTMLElement>("[data-sign-input]")) {
      const key = el.getAttribute("data-sign-input")!;
      const value = fieldValues[key]?.trim();
      if (value) {
        el.textContent = value;
        el.classList.add("sign-filled");
      } else {
        el.classList.remove("sign-filled");
      }
    }
    for (const el of root.querySelectorAll<HTMLElement>("[data-sign-here]")) {
      if (signature) {
        el.textContent = signature.name;
        el.classList.add("sign-ready");
        el.title = "Ready to submit — your signature is applied here";
      } else {
        el.textContent = "▼ Click here to sign ▼";
        el.classList.remove("sign-ready");
        el.title = "";
      }
    }
  }, [fieldValues, signature, html]);

  function onDocClick(e: React.MouseEvent) {
    const target = (e.target as HTMLElement).closest?.(
      "[data-sign-input],[data-sign-here]",
    ) as HTMLElement | null;
    if (!target) return;
    if (target.hasAttribute("data-sign-here")) {
      setSignDialog(true);
      return;
    }
    const key = target.getAttribute("data-sign-input")!;
    const rect = target.getBoundingClientRect();
    setBubble({
      key,
      label: fields.find((f) => f.key === key)?.label ?? key,
      x: Math.max(8, Math.min(rect.left, window.innerWidth - 328)),
      y: Math.min(rect.bottom + 8, window.innerHeight - 220),
    });
  }

  function jumpToNext() {
    const root = docRef.current;
    if (!root) return;
    const target =
      [...root.querySelectorAll<HTMLElement>("[data-sign-input]")].find(
        (el) => !fieldValues[el.getAttribute("data-sign-input")!]?.trim(),
      ) ?? (!signature ? root.querySelector<HTMLElement>("[data-sign-here]") : null);
    if (target) {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      target.click();
    } else {
      document.getElementById("finalize-bar")?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    }
  }

  async function post(body: unknown): Promise<Record<string, unknown> | null> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/contracts/sign/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return null;
      }
      return data;
    } finally {
      setBusy(false);
    }
  }

  /* ── done states ── */
  if (done === "signed") {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-neutral-200 bg-white p-8 text-center shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl dark:bg-green-950">
          ✓
        </span>
        <h2 className="mt-4 text-2xl font-bold">Contract signed!</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Thank you for signing. A copy has been sent to both parties.
        </p>
        <Link
          href={`/signed/${contractId}`}
          className="mt-6 block rounded-2xl bg-linear-to-r from-amber-500 to-orange-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500"
        >
          📄 View signed contract
        </Link>
        <Link
          href={`/verify/${contractId}`}
          className="mt-2 block rounded-2xl border border-neutral-200 px-6 py-3 text-sm font-medium text-neutral-600 hover:border-amber-400 dark:border-neutral-700 dark:text-neutral-300"
        >
          Verify integrity
        </Link>
      </div>
    );
  }
  if (done === "partial") {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-amber-300 bg-amber-50 p-8 text-center dark:border-amber-800 dark:bg-amber-950/40">
        <span className="text-3xl">✍️</span>
        <h2 className="mt-3 text-xl font-bold text-amber-900 dark:text-amber-300">
          Your signature is recorded
        </h2>
        <p className="mt-2 text-sm leading-6 text-amber-800/90 dark:text-amber-300/80">
          The agreement completes once the remaining signers sign — everyone is
          emailed the executed copy.
        </p>
      </div>
    );
  }
  if (done === "declined") {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-neutral-200 p-8 text-center text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
        You declined this contract. The sender has been notified.
      </div>
    );
  }

  return (
    <>
      {/* ── Progress bar ── */}
      <div className="sticky top-14 z-30 -mx-4 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-6 gap-y-2">
          <Meter
            label="Your signature"
            value={signatureDone ? 1 : 0}
            total={1}
            suffix={signatureDone ? "✓" : ""}
          />
          {fields.length > 0 && (
            <Meter label="Your fields" value={filledCount} total={fields.length} suffix="filled" />
          )}
          <Meter
            label="Envelope"
            value={partiesSigned}
            total={partiesTotal}
            suffix="parties signed"
          />
          <button
            onClick={jumpToNext}
            className="ml-auto flex items-center gap-1.5 rounded-full bg-linear-to-r from-amber-500 to-orange-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500"
          >
            {signatureDone && filledCount === fields.length
              ? "Finish below ↓"
              : "Next field →"}
          </button>
        </div>
      </div>

      {/* ── The document ── */}
      <div className="mt-6 rounded-[3px] border border-neutral-300/80 bg-white px-6 py-8 text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_12px_32px_rgba(0,0,0,0.12)] sm:px-10 dark:border-neutral-600">
        <div
          ref={docRef}
          onClick={onDocClick}
          className="prose-reader text-[15px] leading-7"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      {/* ── Finalize bar ── */}
      <div
        id="finalize-bar"
        className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-900"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/50">
            <PenIcon className="h-5 w-5 text-amber-600" />
          </span>
          <div>
            <h2 className="text-lg font-bold">Finalize agreement</h2>
            <p className="text-sm text-neutral-500">
              {myChips > 0
                ? `${myChips} signature ${myChips > 1 ? "areas" : "area"} in the document`
                : "1 signature required from you"}
              {fields.length > 0 &&
                ` · ${filledCount}/${fields.length} fields filled`}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span
            className={`rounded-xl px-3 py-2 text-sm font-medium ${
              signatureDone
                ? "border border-green-300 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
                : "border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
            }`}
          >
            {signatureDone ? `✓ Signed — ${signature!.name}` : "✍ Signature needed"}
          </span>
          {fields
            .filter((f) => !fieldValues[f.key]?.trim())
            .map((f) => (
              <span
                key={f.key}
                className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300"
              >
                {f.key.replace(/[-_]/g, " ")} — unfilled
              </span>
            ))}
        </div>

        {!signatureDone && (
          <button
            onClick={() => setSignDialog(true)}
            className="mt-4 w-full rounded-xl border-2 border-dashed border-amber-400 px-4 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
          >
            ✍ Add your signature
          </button>
        )}

        <label className="mt-4 flex items-start gap-2.5 rounded-xl bg-neutral-50 p-4 text-sm leading-6 text-neutral-600 dark:bg-neutral-800/60 dark:text-neutral-300">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 h-4 w-4 accent-amber-600"
          />
          {consentText}
        </label>

        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            disabled={!readyToSubmit}
            onClick={() => {
              void post({
                action: "sign",
                signerName: signature!.name,
                signatureType: signature!.type,
                signature: signature!.type === "typed" ? signature!.name : signature!.data,
                ...(fields.length > 0 ? { fieldValues } : {}),
              }).then((data) => {
                if (data) setDone(data.complete === false ? "partial" : "signed");
              });
            }}
            className="flex-1 rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500 disabled:opacity-50"
          >
            {busy ? "Submitting…" : "✓ Submit signed contract"}
          </button>
          <button
            disabled={busy}
            onClick={() => setDeclining((v) => !v)}
            className="rounded-xl border border-red-300 px-5 py-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            ✕ Decline
          </button>
        </div>

        {declining && (
          <div className="mt-4 rounded-xl bg-neutral-50 p-4 dark:bg-neutral-800/60">
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Why are you declining? (optional, shared with the sender)"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none dark:border-neutral-700 dark:bg-neutral-900"
            />
            <button
              disabled={busy}
              onClick={() => {
                void post({ action: "decline", declineReason }).then(
                  (data) => data && setDone("declined"),
                );
              }}
              className="mt-2 rounded-lg border border-red-300 px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              Confirm decline
            </button>
          </div>
        )}
      </div>

      {/* ── Fill-in bubble ── */}
      {bubble && (
        <FieldBubble
          bubble={bubble}
          value={fieldValues[bubble.key] ?? ""}
          onApply={(v) => {
            setFieldValues((prev) => ({ ...prev, [bubble.key]: v }));
            setBubble(null);
          }}
          onClose={() => setBubble(null)}
        />
      )}

      {/* ── Signature dialog ── */}
      {signDialog && (
        <SignatureDialog
          initialName={signature?.name ?? signerName}
          onAdd={(sig) => {
            setSignature(sig);
            setSignDialog(false);
          }}
          onClose={() => setSignDialog(false)}
        />
      )}
    </>
  );
}

function Meter({
  label,
  value,
  total,
  suffix,
}: {
  label: string;
  value: number;
  total: number;
  suffix?: string;
}) {
  return (
    <div className="min-w-[130px]">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
        {label}{" "}
        <span className="text-neutral-700 dark:text-neutral-200">
          {value} / {total} {suffix}
        </span>
      </p>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full transition-all ${
            value >= total
              ? "bg-green-500"
              : "bg-linear-to-r from-amber-500 to-orange-600"
          }`}
          style={{ width: `${total === 0 ? 0 : Math.min(100, (value / total) * 100)}%` }}
        />
      </div>
    </div>
  );
}

function FieldBubble({
  bubble,
  value,
  onApply,
  onClose,
}: {
  bubble: { key: string; label: string; x: number; y: number };
  value: string;
  onApply: (value: string) => void;
  onClose: () => void;
}) {
  const [v, setV] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  return (
    <div
      className="fixed z-50 w-80 rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
      style={{ left: bubble.x, top: bubble.y }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold capitalize text-sky-700 dark:text-sky-400">
          {bubble.key.replace(/[-_]/g, " ")}
        </p>
        <button
          onClick={onClose}
          className="rounded-md px-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          ✕
        </button>
      </div>
      <input
        ref={inputRef}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && v.trim()) onApply(v.trim());
          if (e.key === "Escape") onClose();
        }}
        placeholder={bubble.label}
        maxLength={2000}
        className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-sky-500 dark:border-neutral-700 dark:bg-neutral-950"
      />
      <p className="mt-1 text-[11px] text-neutral-400">Enter to apply · Esc to cancel</p>
      <button
        disabled={!v.trim()}
        onClick={() => onApply(v.trim())}
        className="mt-3 w-full rounded-lg bg-linear-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500 disabled:opacity-50"
      >
        Apply
      </button>
    </div>
  );
}

function SignatureDialog({
  initialName,
  onAdd,
  onClose,
}: {
  initialName: string;
  onAdd: (sig: { type: "typed" | "drawn"; data: string; name: string }) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"typed" | "drawn">("typed");
  const [name, setName] = useState(initialName);
  const [drawn, setDrawn] = useState<string | null>(null);
  const valid = name.trim().length >= 2 && (mode === "typed" || drawn !== null);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-6 shadow-2xl dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/50">
            <PenIcon className="h-5 w-5 text-amber-600" />
          </span>
          <h2 className="text-xl font-bold">Sign the agreement</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Type your name or draw your signature. Both are legally binding under
          e-sign laws (UETA / eIDAS).
        </p>

        <div className="mt-4 flex gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800">
          {(["typed", "drawn"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                mode === m
                  ? "bg-white shadow-sm dark:bg-neutral-900"
                  : "text-neutral-500"
              }`}
            >
              {m === "typed" ? "T Type" : "✎ Draw"}
            </button>
          ))}
        </div>

        {mode === "typed" ? (
          <>
            <label className="mt-4 block text-xs font-medium text-neutral-500">
              Full legal name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jane M. Doe"
              className="mt-1 w-full rounded-xl border-2 border-amber-400 px-4 py-2.5 text-sm outline-none focus:border-amber-500 dark:bg-neutral-950"
            />
            <div className="relative mt-4 rounded-xl border-2 border-dashed border-neutral-300 px-4 py-8 text-center dark:border-neutral-700">
              <span className="absolute -top-2.5 left-3 rounded bg-linear-to-r from-amber-500 to-orange-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Preview
              </span>
              {name.trim() ? (
                <p className="font-signature text-5xl leading-tight">{name}</p>
              ) : (
                <p className="text-sm text-neutral-400">
                  Your signature will appear here
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <label className="mt-4 block text-xs font-medium text-neutral-500">
              Full legal name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jane M. Doe"
              className="mt-1 w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-950"
            />
            <div className="mt-4">
              <SignaturePad onChange={setDrawn} />
            </div>
          </>
        )}

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            disabled={!valid}
            onClick={() =>
              onAdd({
                type: mode,
                data: mode === "typed" ? name.trim() : drawn!,
                name: name.trim(),
              })
            }
            className="rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500 disabled:opacity-50"
          >
            ✓ Add signature
          </button>
        </div>
      </div>
    </div>
  );
}
