"use client";

import { useState } from "react";
import { TricklDemo } from "@/components/TricklDemo";

export function PaymentsCard({
  channelId,
  connected,
  chargesEnabled,
  payoutsEnabled,
  onboardedAt,
  tricklEnabled,
  tricklEnabledAt,
}: {
  channelId: string;
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  onboardedAt: string | null;
  tricklEnabled: boolean;
  tricklEnabledAt: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tricklBusy, setTricklBusy] = useState(false);
  const [tricklError, setTricklError] = useState<string | null>(null);
  const [tricklOn, setTricklOn] = useState(tricklEnabled);

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

  async function enableTrickl() {
    setTricklBusy(true);
    setTricklError(null);
    try {
      const res = await fetch("/api/studio/payments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channelId, action: "enable_trickl" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTricklError(data.error ?? `Failed (${res.status})`);
        return;
      }
      setTricklOn(true);
    } finally {
      setTricklBusy(false);
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

      {/* Trickl micro-payments — rides the Stripe account; every spare-change
          chunk pays through to the creator immediately, nothing is held.
          Commerce surfaces only for now. */}
      <div className="mt-6 border-t border-neutral-200 pt-5 dark:border-neutral-800">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium">Trickl micro-payments</h3>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium uppercase ${
              tricklOn
                ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
            }`}
          >
            {tricklOn ? "enabled" : "off"}
          </span>
        </div>
        <p className="mt-1 text-xs leading-5 text-neutral-500">
          Lets supporters pay for books, tickets, and films in small chunks of
          spare change. Each chunk pays through to your Stripe account
          immediately — nothing is saved or held, by CF or anyone.
          {tricklOn && tricklEnabledAt && (
            <> Enabled {new Date(tricklEnabledAt).toLocaleDateString()}.</>
          )}
        </p>
        <TricklDemo />
        {!tricklOn && (
          <button
            onClick={() => void enableTrickl()}
            disabled={tricklBusy || !ready}
            className="mt-3 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
          >
            {tricklBusy ? "Enabling…" : "Enable Trickl"}
          </button>
        )}
        {!ready && !tricklOn && (
          <p className="mt-2 text-xs text-neutral-500">
            Finish Stripe onboarding first — Trickl pays into that account.
          </p>
        )}
        {tricklError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">{tricklError}</p>
        )}
      </div>
    </div>
  );
}
