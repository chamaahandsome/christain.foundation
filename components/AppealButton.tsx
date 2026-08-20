"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AppealButton({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function appeal() {
    const note = window.prompt(
      "Your appeal — address the outcome note directly. Why does the cited teaching not violate the affirmed standard?",
    );
    if (!note || note.trim().length < 10) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/doctrine", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId, note }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? `Failed (${res.status})`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span>
      <button
        onClick={() => void appeal()}
        disabled={busy}
        className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-neutral-700"
      >
        Appeal this decision
      </button>
      {error && <span className="ml-2 text-xs text-red-600 dark:text-red-400">{error}</span>}
    </span>
  );
}
