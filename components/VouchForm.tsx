"use client";

import { useState } from "react";

interface VoucherChannel {
  id: string;
  handle: string;
  name: string;
}

export function VouchForm({
  applicationId,
  channels,
  alreadyVouchedAll,
}: {
  applicationId: string;
  channels: VoucherChannel[];
  alreadyVouchedAll: boolean;
}) {
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (alreadyVouchedAll || done) {
    return (
      <p className="text-sm text-green-600 dark:text-green-400">
        Your vouch is recorded. Thank you — it's visible to the review team.
      </p>
    );
  }

  async function vouch() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/vouch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          applicationId,
          channelId,
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {channels.length > 1 && (
        <div>
          <label className="mb-1 block text-sm font-medium">Vouch as</label>
          <select
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name} (@{channel.handle})
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium">
          How do you know them? (optional, shown to the review team)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={2000}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          placeholder="We served together at…; I've followed their teaching for…"
        />
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        onClick={() => void vouch()}
        disabled={busy || !channelId}
        className="rounded-lg bg-neutral-900 hover:bg-orange-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
      >
        {busy ? "Recording…" : "Vouch for this applicant"}
      </button>
    </div>
  );
}
