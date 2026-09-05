"use client";

// The counterparty's signing panel on /sign/[token]: typed or drawn
// signature, explicit consent, or a decline with reason.

import { useState } from "react";
import { SignaturePad } from "@/components/SignaturePad";

export function SignContract({
  token,
  signerName,
  consentText,
  fields = [],
}: {
  token: string;
  signerName: string;
  consentText: string;
  /** data-filled-by="recipient" fill-ins the signer must answer */
  fields?: { key: string; label: string }[];
}) {
  const [name, setName] = useState(signerName);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<"typed" | "drawn">("typed");
  const [drawn, setDrawn] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"signed" | "partial" | "declined" | null>(null);

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

  if (done === "signed") {
    return (
      <div className="rounded-2xl border border-green-300 bg-green-50 p-6 text-sm leading-6 text-green-900 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200">
        ✍️ Signed. All parties now hold a fully executed agreement — keep this
        page's verification link for your records.
      </div>
    );
  }
  if (done === "partial") {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm leading-6 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        ✍️ Your signature is recorded. The agreement completes once the
        remaining signer{"(s)"} sign — everyone is emailed the executed copy.
      </div>
    );
  }
  if (done === "declined") {
    return (
      <div className="rounded-2xl border border-neutral-200 p-6 text-sm text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
        You declined this contract. The sender has been notified.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
      <h2 className="font-semibold">Sign this agreement</h2>

      {fields.length > 0 && (
        <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/60 p-4 dark:border-sky-900 dark:bg-sky-950/30">
          <p className="text-xs font-semibold uppercase tracking-widest text-sky-700 dark:text-sky-300">
            Your details for the agreement
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            These answers are written into the document before it&apos;s signed.
          </p>
          <div className="mt-3 space-y-2.5">
            {fields.map((f) => (
              <label key={f.key} className="block">
                <span className="text-xs font-medium capitalize text-neutral-600 dark:text-neutral-300">
                  {f.key.replace(/-/g, " ")}
                </span>
                <input
                  value={fieldValues[f.key] ?? ""}
                  onChange={(e) =>
                    setFieldValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                  placeholder={f.label}
                  className="mt-0.5 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-sky-500 dark:border-neutral-700 dark:bg-neutral-900"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <label className="mt-4 block text-xs font-medium text-neutral-500">
        Your full legal name
      </label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900"
      />

      <div className="mt-4 flex gap-2">
        {(["typed", "drawn"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              mode === m
                ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
            }`}
          >
            {m === "typed" ? "Type your signature" : "Draw your signature"}
          </button>
        ))}
      </div>

      {mode === "typed" ? (
        <p className="mt-3 rounded-lg border border-neutral-200 px-4 py-3 font-serif text-2xl italic dark:border-neutral-700">
          {name || "…"}
        </p>
      ) : (
        <div className="mt-3">
          <SignaturePad onChange={setDrawn} />
        </div>
      )}

      <label className="mt-4 flex items-start gap-2 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 accent-amber-600"
        />
        {consentText}
      </label>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          disabled={
            busy ||
            !consent ||
            name.trim().length < 2 ||
            (mode === "drawn" && !drawn) ||
            fields.some((f) => !fieldValues[f.key]?.trim())
          }
          onClick={() => {
            void post({
              action: "sign",
              signerName: name,
              signatureType: mode,
              signature: mode === "typed" ? name.trim() : drawn,
              ...(fields.length > 0 ? { fieldValues } : {}),
            }).then((data) => {
              if (data) setDone(data.complete === false ? "partial" : "signed");
            });
          }}
          className="rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500 disabled:opacity-50"
        >
          {busy ? "Signing…" : "Sign the agreement"}
        </button>
        <button
          disabled={busy}
          onClick={() => setDeclining((v) => !v)}
          className="text-sm text-neutral-500 underline-offset-2 hover:underline"
        >
          Decline instead
        </button>
      </div>

      {declining && (
        <div className="mt-4 rounded-xl bg-neutral-50 p-4 dark:bg-neutral-900/60">
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
  );
}
