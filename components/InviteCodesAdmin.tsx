"use client";

import { useCallback, useEffect, useState } from "react";

interface InviteCode {
  id: string;
  code: string;
  note: string | null;
  email: string | null;
  maxUses: number;
  usageCount: number;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  applications: {
    id: string;
    status: string;
    proposedHandle: string;
    proposedName: string;
  }[];
}

export function InviteCodesAdmin() {
  const [codes, setCodes] = useState<InviteCode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [note, setNote] = useState("");
  const [email, setEmail] = useState("");
  const [maxUses, setMaxUses] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState<number | "">("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/invites");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCodes((await res.json()).codes);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(note ? { note } : {}),
          ...(email ? { email } : {}),
          maxUses,
          ...(expiresInDays ? { expiresInDays } : {}),
        }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? `Failed (${res.status})`);
        return;
      }
      setNote("");
      setEmail("");
      setMaxUses(1);
      setExpiresInDays("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!window.confirm("Revoke this code? Applicants can no longer redeem it.")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action: "revoke" }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? `Failed (${res.status})`);
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  function statusOf(code: InviteCode): string {
    if (code.revokedAt) return "revoked";
    if (code.expiresAt && new Date(code.expiresAt).getTime() < Date.now()) return "expired";
    if (code.usageCount >= code.maxUses) return "used";
    return "open";
  }

  if (error && !codes) return <p className="mt-6 text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (!codes) return <p className="mt-6 text-sm text-neutral-500">Loading…</p>;

  return (
    <div className="mt-6 space-y-8">
      <section className="rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
        <h2 className="text-lg font-medium">Mint a code</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Note (who is this for?)</label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              placeholder="Pastor John — Grace Chapel"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Email (optional)</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Max uses</label>
            <input
              value={maxUses}
              onChange={(e) => setMaxUses(Math.max(1, Number(e.target.value) || 1))}
              type="number"
              min={1}
              max={100}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Expires in (days, optional)</label>
            <input
              value={expiresInDays}
              onChange={(e) =>
                setExpiresInDays(e.target.value === "" ? "" : Math.max(1, Number(e.target.value) || 1))
              }
              type="number"
              min={1}
              max={365}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            />
          </div>
        </div>
        <button
          onClick={() => void create()}
          disabled={busy}
          className="mt-4 rounded-lg bg-neutral-900 hover:bg-orange-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
        >
          Mint code
        </button>
      </section>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <section>
        <h2 className="text-lg font-medium">Codes</h2>
        {codes.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No codes minted yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {codes.map((code) => {
              const status = statusOf(code);
              return (
                <li
                  key={code.id}
                  className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-lg font-medium tracking-wide">
                        {code.code}{" "}
                        <span
                          className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium uppercase ${
                            status === "open"
                              ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                              : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                          }`}
                        >
                          {status}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-neutral-500">
                        {code.note ?? "—"}
                        {code.email && <> · {code.email}</>} · {code.usageCount}/
                        {code.maxUses} used
                        {code.expiresAt && (
                          <> · expires {new Date(code.expiresAt).toLocaleDateString()}</>
                        )}
                      </p>
                      {code.applications.length > 0 && (
                        <p className="mt-1 text-xs text-neutral-500">
                          Redeemed by:{" "}
                          {code.applications
                            .map((a) => `${a.proposedName} (@${a.proposedHandle}, ${a.status})`)
                            .join(", ")}
                        </p>
                      )}
                    </div>
                    {status === "open" && (
                      <button
                        onClick={() => void revoke(code.id)}
                        disabled={busy}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 disabled:opacity-50 dark:border-red-900"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
