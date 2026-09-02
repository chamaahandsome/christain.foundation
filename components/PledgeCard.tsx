"use client";

// Public pledge form: amount, optional reward tier, word of encouragement,
// per-transaction disclosure. Trickl appears on no-reward pledges in the
// tip window ($3–$40) — spare-change pledges, both categories.

import { useState } from "react";
import {
  PLEDGE_TRICKL_MAX_CENTS,
  PLEDGE_TRICKL_MIN_CENTS,
  rewardAvailable,
} from "@/lib/campaigns";

interface Reward {
  id: string;
  title: string;
  description: string;
  amountCents: number;
  maxBackers: number | null;
  backersCount: number;
  active: boolean;
  imageUrl: string | null;
  deliveryType: string;
}

const PRESETS = [1000, 2500, 5000, 10000];

export function PledgeCard({
  campaignId,
  category,
  channelName,
  rewards,
  signedIn,
  tricklEnabled,
}: {
  campaignId: string;
  category: string;
  channelName: string;
  rewards: Reward[];
  signedIn: boolean;
  tricklEnabled: boolean;
}) {
  const [amount, setAmount] = useState<number>(2500);
  const [custom, setCustom] = useState("");
  const [rewardId, setRewardId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState<"stripe" | "trickl" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const amountCents = custom ? Math.round(Number(custom) * 100) : amount;
  const reward = rewards.find((r) => r.id === rewardId) ?? null;
  const effectiveCents = reward ? Math.max(amountCents, reward.amountCents) : amountCents;
  const tricklFits =
    tricklEnabled &&
    !reward &&
    Number.isFinite(effectiveCents) &&
    effectiveCents >= PLEDGE_TRICKL_MIN_CENTS &&
    effectiveCents <= PLEDGE_TRICKL_MAX_CENTS;

  async function pledge(provider: "stripe" | "trickl") {
    setBusy(provider);
    setError(null);
    try {
      const res = await fetch("/api/checkout/pledge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          campaignId,
          amountCents: effectiveCents,
          provider,
          anonymous,
          ...(reward ? { rewardId: reward.id } : {}),
          ...(message.trim() ? { message: message.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (res.status === 401) {
        setError("Sign in to back this campaign.");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      window.location.href = data.url;
    } finally {
      setBusy(null);
    }
  }

  const activeRewards = rewards.filter((r) => r.active);

  return (
    <div className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
      {activeRewards.length > 0 && (
        <div className="mb-5 space-y-2">
          <p className="text-sm font-medium">Choose a reward (optional)</p>
          <button
            onClick={() => setRewardId(null)}
            className={`block w-full rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${
              rewardId === null
                ? "border-amber-500 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/30"
                : "border-neutral-200 hover:border-amber-300 dark:border-neutral-700"
            }`}
          >
            <span className="font-medium">Just back it</span>
            <span className="ml-2 text-neutral-500">no reward — every dollar helps</span>
          </button>
          {activeRewards.map((r) => {
            const available = rewardAvailable(r);
            return (
              <button
                key={r.id}
                disabled={!available}
                onClick={() => {
                  setRewardId(r.id);
                  if (amountCents < r.amountCents) {
                    setAmount(r.amountCents);
                    setCustom("");
                  }
                }}
                className={`block w-full rounded-xl border px-4 py-2.5 text-left text-sm transition-colors disabled:opacity-50 ${
                  rewardId === r.id
                    ? "border-amber-500 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/30"
                    : "border-neutral-200 hover:border-amber-300 dark:border-neutral-700"
                }`}
              >
                <div className="flex items-start gap-3">
                  {r.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.imageUrl}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">
                        ${(r.amountCents / 100).toFixed(0)}+ — {r.title}
                      </span>
                      <span className="shrink-0 text-xs text-neutral-500">
                        {available
                          ? r.maxBackers
                            ? `${r.maxBackers - r.backersCount} left`
                            : `${r.backersCount} claimed`
                          : "fully claimed"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs leading-5 text-neutral-500">
                      {r.description}
                      {r.deliveryType === "physical" && (
                        <span className="ml-1 text-neutral-400">
                          · 📦 ships to you — address collected at checkout
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

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
            placeholder="other"
            className="w-16 bg-transparent py-2 text-sm outline-none"
          />
        </div>
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder={`A word of encouragement for ${channelName} (optional)`}
        className="mt-4 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-amber-600"
      />
      <label className="mt-2 flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
        <input
          type="checkbox"
          checked={anonymous}
          onChange={(e) => setAnonymous(e.target.checked)}
          className="h-3.5 w-3.5 accent-amber-600"
        />
        Keep my name private
      </label>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          onClick={() => void pledge("stripe")}
          disabled={busy !== null || !Number.isFinite(effectiveCents) || effectiveCents < 100}
          className="w-full rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 sm:w-auto"
        >
          {busy === "stripe"
            ? "Opening checkout…"
            : `🤝 Back this campaign · $${(effectiveCents / 100 || 0).toFixed(2)}`}
        </button>
        {tricklFits && (
          <button
            onClick={() => void pledge("trickl")}
            disabled={busy !== null}
            className="w-full rounded-xl border border-teal-500 px-5 py-3 text-sm font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-50 sm:w-auto dark:text-teal-400 dark:hover:bg-teal-950/30"
          >
            {busy === "trickl" ? "Starting Trickl…" : "Pledge bit-by-bit with Trickl"}
          </button>
        )}
      </div>
      {!signedIn && (
        <p className="mt-2 text-xs text-neutral-500">Sign in to back this campaign.</p>
      )}
    </div>
  );
}
