"use client";

import { useState } from "react";

export function IngestButton({ channelId }: { channelId: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/studio/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channelId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(data.error ?? `Failed (${res.status})`);
        return;
      }
      setResult(
        `Imported ${data.ingested} of ${data.discovered} videos${data.skipped ? ` (${data.skipped} skipped)` : ""}.`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="text-right">
      <button
        onClick={() => void run()}
        disabled={busy}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {busy ? "Importing…" : "Import from YouTube"}
      </button>
      {result && <p className="mt-2 text-xs text-neutral-500">{result}</p>}
    </div>
  );
}
