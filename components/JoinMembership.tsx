"use client";

// Public membership tiers on the support page: pick a tier, subscribe
// monthly on the creator's account, unlock members-only content.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Tier {
  id: string;
  name: string;
  description: string;
  priceCents: number;
}

export function JoinMembership({
  channelId,
  channelName,
  tiers,
  signedIn,
  memberTierName,
}: {
  channelId: string;
  channelName: string;
  tiers: Tier[];
  signedIn: boolean;
  memberTierName: string | null; // set when the viewer is an active member
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  async function join(tierId: string) {
    setBusy(tierId);
    setError(null);
    try {
      const res = await fetch("/api/checkout/membership", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tierId }),
      });
      const data = await res.json();
      if (res.status === 401) {
        setError("Sign in to become a member.");
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

  async function cancel() {
    setBusy("cancel");
    setError(null);
    try {
      const res = await fetch("/api/membership/cancel", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channelId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (memberTierName) {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm dark:border-amber-800 dark:bg-amber-950/30">
        <p className="font-medium text-amber-900 dark:text-amber-200">
          ⭐ You&apos;re a member — {memberTierName}
        </p>
        <p className="mt-1 text-amber-800/80 dark:text-amber-300/80">
          Members-only content from {channelName} is unlocked for you.
        </p>
        {error && <p className="mt-2 text-red-600 dark:text-red-400">{error}</p>}
        <button
          disabled={busy !== null}
          onClick={() => setConfirmCancel(true)}
          className="mt-3 text-xs text-amber-700 underline-offset-2 hover:underline dark:text-amber-400"
        >
          Cancel membership
        </button>
        <ConfirmDialog
          open={confirmCancel}
          title="Cancel your membership?"
          body="You keep access until the end of the period you've paid for, then it ends. You can rejoin anytime."
          confirmLabel="Cancel membership"
          destructive
          onConfirm={() => {
            setConfirmCancel(false);
            void cancel();
          }}
          onCancel={() => setConfirmCancel(false)}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {tiers.map((t) => (
          <div
            key={t.id}
            className="flex flex-col rounded-2xl border border-neutral-200 p-5 transition-colors hover:border-amber-400 dark:border-neutral-800 dark:hover:border-amber-600"
          >
            <p className="text-lg font-semibold">
              ${(t.priceCents / 100).toFixed(0)}
              <span className="text-sm font-normal text-neutral-500">/month</span>
            </p>
            <p className="mt-0.5 font-medium">{t.name}</p>
            <p className="mt-1 flex-1 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              {t.description}
            </p>
            <button
              disabled={busy !== null}
              onClick={() => void join(t.id)}
              className="mt-4 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
            >
              {busy === t.id ? "Opening checkout…" : "Become a member"}
            </button>
          </div>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!signedIn && (
        <p className="mt-2 text-xs text-neutral-500">Sign in to become a member.</p>
      )}
    </div>
  );
}
