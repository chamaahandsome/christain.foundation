"use client";

import { useState } from "react";

export function PaymentsCard({
  channelId,
  connected,
  chargesEnabled,
  payoutsEnabled,
  onboardedAt,
}: {
  channelId: string;
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  onboardedAt: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onboard() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/payments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channelId, action: "onboard" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      window.location.href = data.url;
    } finally {
      setBusy(false);
    }
  }

  const ready = connected && chargesEnabled && payoutsEnabled;

  function Row({ label, ok }: { label: string; ok: boolean }) {
    return (
      <li className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase ${
            ok
              ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
          }`}
        >
          {ok ? "ready" : "pending"}
        </span>
      </li>
    );
  }

  return (
    <div className="mt-6 max-w-lg rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
      <h2 className="text-lg font-medium">
        {ready ? "Payments ready" : "Set up payouts"}
      </h2>
      {onboardedAt && (
        <p className="mt-1 text-xs text-neutral-500">
          Stripe details submitted {new Date(onboardedAt).toLocaleDateString()}.
        </p>
      )}
      <ul className="mt-4 space-y-2">
        <Row label="Stripe account connected" ok={connected} />
        <Row label="Charges enabled" ok={chargesEnabled} />
        <Row label="Payouts enabled" ok={payoutsEnabled} />
      </ul>
      {!ready && (
        <button
          onClick={() => void onboard()}
          disabled={busy}
          className="mt-5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
        >
          {busy ? "Opening Stripe…" : connected ? "Resume onboarding" : "Connect with Stripe"}
        </button>
      )}
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <p className="mt-4 text-xs leading-5 text-neutral-500">
        A channel that can't receive payouts can't publish revenue surfaces —
        pricing, giving, and tickets stay hidden until Stripe is ready.
      </p>
    </div>
  );
}
