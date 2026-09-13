"use client";

// Milk or meat on a Start Here card (Hebrews 5:12–14; 1 Corinthians 3:2).
// Milk is foundational teaching a new believer can take in straight away;
// meat is heavier, worth coming back to once the foundations are down.
//
// Everyone sees a label. Admins see a switch: one tap flips it and saves
// for everyone, and a failed save puts the label back and says so.

import { useState } from "react";
import type { StartHereDepth } from "@/lib/start-here";

const COPY: Record<StartHereDepth, { label: string; hint: string }> = {
  milk: { label: "Milk", hint: "Foundational teaching — easy to take in" },
  meat: { label: "Meat", hint: "Heavier teaching — for once the foundations are down" },
};

function MilkIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 2h6" />
      <path d="M10 2v3.5L7 9v11a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V9l-3-3.5V2" />
      <path d="M7 13h10" />
    </svg>
  );
}

function MeatIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15.4 15.63a7.88 6 135 1 1 6.23-6.23 4.3 3.3 135 0 0-6.23 6.23" />
      <path d="m8.29 12.71-2.6 2.6a2.5 2.5 0 1 0-1.65 4.65A2.5 2.5 0 1 0 8.7 18.3l2.59-2.59" />
    </svg>
  );
}

export function DepthBadge({
  depth,
  itemKey,
  editable = false,
}: {
  depth: StartHereDepth;
  /** "video:<id>" or "series:<playlistId>" — see lib/start-here. */
  itemKey: string;
  /** Admins only: render as a switch that saves. */
  editable?: boolean;
}) {
  const [current, setCurrent] = useState<StartHereDepth>(depth);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = COPY[current];
  const other: StartHereDepth = current === "milk" ? "meat" : "milk";
  const tone =
    current === "meat"
      ? "bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900/60"
      : "bg-white text-neutral-700 ring-neutral-200 dark:bg-neutral-900 dark:text-neutral-300 dark:ring-neutral-700";
  const base = `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${tone}`;
  const body = (
    <>
      {current === "meat" ? <MeatIcon /> : <MilkIcon />}
      <span>{copy.label}</span>
    </>
  );

  if (!editable) {
    return (
      <span className={base} title={copy.hint}>
        {body}
      </span>
    );
  }

  async function flip() {
    const previous = current;
    setCurrent(other);
    setSaving(true);
    setError(null);
    // The server's own explanation, when it gives one, beats a generic retry
    // prompt — a switch that can't save won't start saving on a retry.
    let reason: string | null = null;
    try {
      const res = await fetch("/api/admin/start-here/depth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: itemKey, depth: other }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: unknown };
        if (typeof data.error === "string") reason = data.error;
        throw new Error(`save failed (${res.status})`);
      }
    } catch {
      setCurrent(previous);
      setError(reason ?? "Couldn't save — try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={flip}
        disabled={saving}
        aria-label={`${copy.label}. Switch to ${COPY[other].label.toLowerCase()}`}
        title={`${copy.hint} — click to switch to ${COPY[other].label.toLowerCase()}`}
        className={`${base} cursor-pointer transition-shadow hover:ring-2 disabled:cursor-wait disabled:opacity-60`}
      >
        {body}
        <span aria-hidden className="text-[10px] opacity-60">
          ⇄
        </span>
      </button>
      {error && (
        <span role="status" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </span>
  );
}
