"use client";

// "A Cup of Cold Water" — preset amounts, an optional word of encouragement,
// and the Mode B disclosure in plain sight before checkout.

import { useState } from "react";
import { TIP_TRICKL_MAX_CENTS, TIP_TRICKL_MIN_CENTS } from "@/lib/giving";

const PRESETS = [300, 500, 1000, 2500];
const POUR_CENTS = 100; // each tap on the glass pours in a dollar
const GLASS_FULL_CENTS = 2500; // the glass reads full at $25
const GLASS_MAX_CENTS = 50_000; // CUP_MAX — stop pouring past the server cap

/** The glass itself: tap to pour, the water level tracks the amount. */
function WaterGlass({
  amountCents,
  onPour,
}: {
  amountCents: number;
  onPour: () => void;
}) {
  const [pouring, setPouring] = useState(false);
  const ratio = Number.isFinite(amountCents)
    ? Math.max(0, Math.min(amountCents / GLASS_FULL_CENTS, 1))
    : 0;
  // Inner cavity of the glass runs y=11 (brim) to y=79 (base).
  const waterTop = 79 - 68 * ratio;

  return (
    <button
      type="button"
      onClick={() => {
        onPour();
        setPouring(true);
        window.setTimeout(() => setPouring(false), 300);
      }}
      aria-label="Pour a dollar into the glass"
      title="Tap to add $1"
      className={`group flex flex-col items-center gap-1.5 self-center rounded-xl px-2 py-1 transition-transform hover:scale-[1.04] active:scale-95 ${
        pouring ? "scale-[1.04]" : ""
      }`}
    >
      <svg width="60" height="92" viewBox="0 0 64 96" aria-hidden="true">
        <defs>
          <linearGradient id="cupWater" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="55%" stopColor="#4db8f5" />
            <stop offset="100%" stopColor="#2ea3ec" />
          </linearGradient>
          <linearGradient id="cupGlass" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#94a3b8" stopOpacity="0.22" />
            <stop offset="18%" stopColor="#e2e8f0" stopOpacity="0.10" />
            <stop offset="50%" stopColor="#f8fafc" stopOpacity="0.05" />
            <stop offset="82%" stopColor="#e2e8f0" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.28" />
          </linearGradient>
          <clipPath id="cupCavity">
            <path d="M19 11 L45 11 L42.4 76 Q42.1 80.5 37.6 80.5 L26.4 80.5 Q21.9 80.5 21.6 76 Z" />
          </clipPath>
        </defs>

        {/* shadow under the base */}
        <ellipse
          cx="32"
          cy="88"
          rx="13"
          ry="2.4"
          className="fill-neutral-900/10 dark:fill-black/40"
        />

        {/* glass body tint — reads as glass even when empty */}
        <path
          d="M17 8 L47 8 L44.2 77 Q43.8 83 38 83 L26 83 Q20.2 83 19.8 77 Z"
          fill="url(#cupGlass)"
        />

        {/* water */}
        <g clipPath="url(#cupCavity)">
          <rect
            x="16"
            width="32"
            y={waterTop}
            height={96 - waterTop}
            fill="url(#cupWater)"
            style={{ transition: "y 0.45s ease, height 0.45s ease" }}
          />
          {ratio > 0 && (
            <ellipse
              cx="32"
              cy={waterTop}
              rx="12.6"
              ry="2"
              fill="#cdeafd"
              opacity="0.95"
              style={{ transition: "cy 0.45s ease" }}
            />
          )}
          {/* light catching the side of the glass */}
          <rect
            x="23"
            y="14"
            width="3"
            height="62"
            rx="1.5"
            fill="#ffffff"
            opacity="0.45"
          />
        </g>

        {/* glass outline — thin, tapered, rounded base */}
        <path
          d="M17 8 L47 8 L44.2 77 Q43.8 83 38 83 L26 83 Q20.2 83 19.8 77 Z"
          fill="none"
          strokeWidth="1.75"
          strokeLinejoin="round"
          className="stroke-neutral-300 transition-colors group-hover:stroke-sky-400 dark:stroke-neutral-600"
        />
        {/* brim */}
        <line
          x1="17"
          y1="8"
          x2="47"
          y2="8"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="stroke-neutral-300 transition-colors group-hover:stroke-sky-400 dark:stroke-neutral-600"
        />
      </svg>
      <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-sky-600 transition-colors group-hover:border-sky-300 group-hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-400">
        +$1 · tap
      </span>
    </button>
  );
}

export function TipCard({
  channelId,
  channelName,
  signedIn,
  tricklEnabled = false,
}: {
  channelId: string;
  channelName: string;
  signedIn: boolean;
  tricklEnabled?: boolean;
}) {
  const [amount, setAmount] = useState<number>(500);
  const [custom, setCustom] = useState("");
  const [note, setNote] = useState("");
  const [monthly, setMonthly] = useState(false);
  const [busy, setBusy] = useState<"stripe" | "trickl" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const amountCents = custom ? Math.round(Number(custom) * 100) : amount;
  const tricklFits =
    tricklEnabled &&
    Number.isFinite(amountCents) &&
    amountCents >= TIP_TRICKL_MIN_CENTS &&
    amountCents <= TIP_TRICKL_MAX_CENTS;

  async function send(provider: "stripe" | "trickl") {
    setBusy(provider);
    setError(null);
    try {
      const res = await fetch("/api/checkout/tip", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channelId,
          amountCents,
          provider,
          monthly,
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
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
      <div className="flex gap-4">
        <WaterGlass
          amountCents={amountCents}
          onPour={() => {
            const base =
              Number.isFinite(amountCents) && amountCents > 0 ? amountCents : 0;
            setAmount(Math.min(base + POUR_CENTS, GLASS_MAX_CENTS));
            setCustom("");
          }}
        />
        <div className="min-w-0 flex-1">
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
        </div>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button
          onClick={() => void send("stripe")}
          disabled={
            busy !== null || !Number.isFinite(amountCents) || amountCents < 100
          }
          className="w-full rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 sm:w-auto"
        >
          {busy === "stripe"
            ? "Opening checkout…"
            : monthly
              ? `💧 Send a monthly cup · $${(amountCents / 100 || 0).toFixed(2)}/mo`
              : `💧 Send a cup of cold water · $${(amountCents / 100 || 0).toFixed(2)}`}
        </button>
        {tricklFits && (
          <button
            onClick={() => void send("trickl")}
            disabled={busy !== null}
            className="w-full rounded-xl border border-teal-500 px-5 py-3 text-sm font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-50 sm:w-auto dark:text-teal-400 dark:hover:bg-teal-950/30"
          >
            {busy === "trickl"
              ? "Starting Trickl…"
              : "Give bit-by-bit with Trickl"}
          </button>
        )}
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
        <input
          type="checkbox"
          checked={monthly}
          onChange={(e) => setMonthly(e.target.checked)}
          className="h-3.5 w-3.5 accent-amber-600"
        />
        Make it monthly — a ${(amountCents / 100 || 0).toFixed(2)} cup, every
        month{tricklFits ? " (Trickl gathers it in spare change)" : ""}.
      </label>
      {!signedIn && (
        <p className="mt-2 text-xs text-neutral-500">
          Sign in/up to send a cup.
        </p>
      )}
    </div>
  );
}
