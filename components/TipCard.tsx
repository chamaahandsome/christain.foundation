"use client";

// "A Cup of Cold Water" — preset amounts, an optional word of encouragement,
// and the Mode B disclosure in plain sight before checkout.

import { useState } from "react";

const PRESETS = [300, 500, 1000, 2500];

export function TipCard({
  channelId,
  channelName,
  signedIn,
}: {
  channelId: string;
  channelName: string;
  signedIn: boolean;
}) {
  const [amount, setAmount] = useState<number>(500);
  const [custom, setCustom] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountCents = custom ? Math.round(Number(custom) * 100) : amount;

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/tip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channelId,
          amountCents,
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (res.status === 401) {
        setError("Sign in first — your cup carries your name.");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      window.location.href = data.url;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            onClick={() => {
              setAmount(preset);
              setCustom("");
            }}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              !custom && amount === preset
                ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                : "bg-neutral-100 text-neutral-700 hover:bg-amber-100 hover:text-amber-900 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-amber-950 dark:hover:text-amber-300"
            }`}
          >
            ${(preset / 100).toFixed(0)}
          </button>
        ))}
        <div className="flex items-center gap-1 rounded-xl bg-neutral-100 px-3 dark:bg-neutral-800">
          <span className="text-sm text-neutral-500">$</span>
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            type="number"
            min={1}
            max={500}
            placeholder="other"
            className="w-16 bg-transparent py-2 text-sm outline-none"
          />
        </div>
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={280}
        placeholder={`A word of encouragement for ${channelName} (optional)`}
        className="mt-4 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-amber-600"
      />

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        onClick={() => void send()}
        disabled={busy || !Number.isFinite(amountCents) || amountCents < 100}
        className="mt-4 w-full rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 sm:w-auto"
      >
        {busy
          ? "Opening checkout…"
          : `💧 Send a cup of cold water · $${(amountCents / 100 || 0).toFixed(2)}`}
      </button>
      {!signedIn && (
        <p className="mt-2 text-xs text-neutral-500">Sign in to send a cup.</p>
      )}
    </div>
  );
}
