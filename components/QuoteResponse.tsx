"use client";

// Accept / decline buttons on the public quote page.

import { useState } from "react";

export function QuoteResponse({
  token,
  channelName,
}: {
  token: string;
  channelName: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);

  async function respond(action: "accept" | "decline") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/quotes/${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      setDone(action === "accept" ? "accepted" : "declined");
    } finally {
      setBusy(false);
    }
  }

  if (done === "accepted") {
    return (
      <div className="rounded-2xl border border-green-300 bg-green-50 p-5 text-sm leading-6 text-green-900 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200">
        🎉 Accepted — {channelName} is drafting the agreement; the signing link
        will reach your email.
      </div>
    );
  }
  if (done === "declined") {
    return (
      <p className="rounded-xl border border-neutral-200 p-5 text-sm text-neutral-500 dark:border-neutral-800">
        You declined this quote. {channelName} has been notified.
      </p>
    );
  }

  return (
    <div>
      {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button
          disabled={busy}
          onClick={() => void respond("accept")}
          className="rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500 disabled:opacity-50"
        >
          {busy ? "Working…" : "Accept quote"}
        </button>
        <button
          disabled={busy}
          onClick={() => void respond("decline")}
          className="rounded-xl border border-neutral-300 px-5 py-3 text-sm font-medium text-neutral-600 hover:border-red-400 hover:text-red-600 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300"
        >
          Decline
        </button>
      </div>
      <p className="mt-3 text-xs text-neutral-500">
        Accepting turns this quote into an agreement for signature — nothing is
        charged here.
      </p>
    </div>
  );
}
