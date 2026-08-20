"use client";

// Report published teaching to the doctrine review queue (§5.4). Deliberately
// quiet chrome — discernment, not a rage button. The claim must cite the
// teaching concretely; lib/doctrine.ts enforces the floor server-side.

import { useState } from "react";

export function ReportTeachingButton({ contentItemId }: { contentItemId: string }) {
  const [open, setOpen] = useState(false);
  const [claim, setClaim] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentItemId, claim }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setError("Sign in to file a report — claims go on the record.");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="mt-6 text-xs text-neutral-500">
        Report received. It joins the doctrine review queue — review runs on
        the teaching, and outcomes are never noteless.
      </p>
    );
  }

  return (
    <div className="mt-6">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-neutral-400 underline-offset-2 hover:text-amber-600 hover:underline"
        >
          Report a doctrinal concern with this teaching
        </button>
      ) : (
        <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <p className="text-sm font-medium">Report a doctrinal concern</p>
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            Cite the teaching concretely — what is claimed, where in the video,
            and which part of the affirmed standard it violates. Critique of
            public teaching is legitimate discernment; this is not the place
            for complaints about the person.
          </p>
          <textarea
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            rows={4}
            maxLength={5000}
            className="mt-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            placeholder='e.g. "At 14:32 the teacher states that…, which contradicts the affirmation that…"'
          />
          {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => void submit()}
              disabled={busy || claim.trim().length === 0}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
            >
              {busy ? "Filing…" : "File report"}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs dark:border-neutral-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
