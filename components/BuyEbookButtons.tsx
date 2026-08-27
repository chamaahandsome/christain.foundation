"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function BuyEbookButtons({
  ebookId,
  priceCents,
  owned,
  tricklAvailable,
  signedIn,
}: {
  ebookId: string;
  priceCents: number;
  owned: boolean;
  tricklAvailable: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkout(provider: "stripe" | "trickl") {
    setBusy(provider);
    setError(null);
    try {
      const res = await fetch("/api/checkout/ebook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ebookId, provider }),
      });
      const data = await res.json();
      if (res.status === 401) {
        setError("Sign in first — the book attaches to your account.");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      if (data.granted) {
        router.refresh();
        return;
      }
      window.location.href = data.url;
    } finally {
      setBusy(null);
    }
  }

  if (owned) {
    return (
      <Link
        href={`/read/${ebookId}`}
        className="inline-block rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-orange-600 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
      >
        Read now
      </Link>
    );
  }

  const price = (priceCents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={() => void checkout("stripe")}
        disabled={busy !== null}
        className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
      >
        {busy === "stripe"
          ? "Opening checkout…"
          : priceCents === 0
            ? "Get for free"
            : `Buy for ${price}`}
      </button>
      {tricklAvailable && (
        <button
          onClick={() => void checkout("trickl")}
          disabled={busy !== null}
          className="rounded-lg border border-teal-500 px-5 py-2.5 text-sm font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-50 dark:text-teal-400 dark:hover:bg-teal-950/30"
        >
          {busy === "trickl" ? "Starting plan…" : "Pay bit-by-bit with Trickl"}
        </button>
      )}
      {!signedIn && (
        <span className="text-xs text-neutral-500">Sign in to purchase.</span>
      )}
      {error && <p className="w-full text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
