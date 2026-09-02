"use client";

// Studio membership-tier manager (Payments tab, owner-only). Tiers are
// commerce: access for a monthly subscription, CF's fee per cycle.

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Tier {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  active: boolean;
  membersCount: number;
}

export function MembershipTiersCard({
  channelId,
  tiers,
  ready,
}: {
  channelId: string;
  tiers: Tier[];
  ready: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("5");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input =
    "rounded-lg border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900";

  async function call(method: string, body: unknown): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/memberships", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Failed (${res.status})`);
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 border-t border-neutral-200 pt-5 dark:border-neutral-800">
      <h3 className="text-sm font-medium">Membership tiers</h3>
      <p className="mt-1 text-xs leading-5 text-neutral-500">
        Members subscribe monthly and unlock your members-only content. This
        is a purchase, not a gift — you deliver what the tier promises.
      </p>

      <div className="mt-3 space-y-2">
        {tiers.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <span className={t.active ? "" : "line-through opacity-60"}>
                <span className="font-medium">${(t.priceCents / 100).toFixed(0)}/mo</span>{" "}
                — {t.name}
              </span>
              <span className="ml-2 text-xs text-neutral-500">
                {t.membersCount} member{t.membersCount === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                disabled={busy}
                onClick={() =>
                  void call("PATCH", { channelId, tierId: t.id, active: !t.active })
                }
                className="text-xs text-neutral-500 hover:text-amber-700 dark:hover:text-amber-400"
              >
                {t.active ? "Deactivate" : "Activate"}
              </button>
              {t.membersCount === 0 && (
                <button
                  disabled={busy}
                  onClick={() => void call("DELETE", { channelId, tierId: t.id })}
                  className="text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tier name"
          className={`${input} w-36`}
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What members get"
          className={`${input} min-w-0 flex-1`}
        />
        <div className="flex items-center gap-1">
          <span className="text-xs text-neutral-500">$</span>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            type="number"
            min={2}
            className={`${input} w-20`}
          />
          <span className="text-xs text-neutral-500">/mo</span>
        </div>
        <button
          disabled={busy || !ready || !name.trim() || !description.trim()}
          title={ready ? undefined : "Finish Stripe onboarding first"}
          onClick={() => {
            void call("POST", {
              channelId,
              name,
              description,
              priceCents: Math.round(Number(price) * 100),
            }).then((ok) => {
              if (ok) {
                setName("");
                setDescription("");
              }
            });
          }}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
        >
          Add tier
        </button>
      </div>
    </div>
  );
}
