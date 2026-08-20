"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface ReviewCase {
  id: string;
  status: string;
  claim: string;
  outcomeNote: string | null;
  appealNote: string | null;
  createdAt: string;
  decidedAt: string | null;
  channel: { handle: string; name: string };
  contentItem: { id: string; title: string } | null;
}

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  IN_REVIEW: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  APPEALED: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  UPHELD: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  DISMISSED: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
};

export function DoctrineQueue() {
  const [queue, setQueue] = useState<ReviewCase[] | null>(null);
  const [decided, setDecided] = useState<ReviewCase[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/doctrine");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setQueue(data.queue);
      setDecided(data.decided);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(caseId: string, action: "start_review" | "uphold" | "dismiss") {
    let note: string | undefined;
    if (action !== "start_review") {
      note =
        window.prompt(
          `${action === "uphold" ? "Uphold" : "Dismiss"} — outcome note (required, shown to the channel):`,
        ) ?? undefined;
      if (!note || note.trim().length < 10) return;
    }
    setBusyId(caseId);
    try {
      const res = await fetch("/api/admin/doctrine", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, caseId, ...(note ? { note } : {}) }),
      });
      if (!res.ok) {
        const data = await res.json();
        window.alert(data.error ?? `Failed (${res.status})`);
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (error) return <p className="mt-6 text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (!queue) return <p className="mt-6 text-sm text-neutral-500">Loading…</p>;

  function CaseCard({ reviewCase, actions }: { reviewCase: ReviewCase; actions: boolean }) {
    return (
      <li className="rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-medium">
              @{reviewCase.channel.handle}{" "}
              <span
                className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium uppercase ${STATUS_STYLES[reviewCase.status] ?? ""}`}
              >
                {reviewCase.status.replace("_", " ")}
              </span>
            </p>
            <p className="text-sm text-neutral-500">
              {reviewCase.channel.name}
              {reviewCase.contentItem && (
                <>
                  {" · "}
                  <Link
                    href={`/watch/${reviewCase.contentItem.id}`}
                    className="underline"
                    target="_blank"
                  >
                    {reviewCase.contentItem.title}
                  </Link>
                </>
              )}
            </p>
          </div>
          {actions && (
            <div className="flex gap-2">
              {reviewCase.status === "OPEN" && (
                <button
                  onClick={() => void act(reviewCase.id, "start_review")}
                  disabled={busyId === reviewCase.id}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-neutral-700"
                >
                  Start review
                </button>
              )}
              <button
                onClick={() => void act(reviewCase.id, "dismiss")}
                disabled={busyId === reviewCase.id}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-neutral-700"
              >
                Dismiss
              </button>
              <button
                onClick={() => void act(reviewCase.id, "uphold")}
                disabled={busyId === reviewCase.id}
                className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
              >
                Uphold
              </button>
            </div>
          )}
        </div>
        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-neutral-600 dark:text-neutral-400">
          {reviewCase.claim}
        </p>
        {reviewCase.appealNote && (
          <p className="mt-3 rounded-lg bg-purple-50 p-3 text-sm leading-6 text-purple-900 dark:bg-purple-950/40 dark:text-purple-200">
            <span className="font-medium">Appeal:</span> {reviewCase.appealNote}
          </p>
        )}
        {reviewCase.outcomeNote && (
          <p className="mt-3 text-xs text-neutral-500">
            Outcome: {reviewCase.outcomeNote}
          </p>
        )}
      </li>
    );
  }

  return (
    <div className="mt-6 space-y-10">
      <section>
        {queue.length === 0 ? (
          <p className="text-sm text-neutral-500">The queue is empty.</p>
        ) : (
          <ul className="space-y-4">
            {queue.map((reviewCase) => (
              <CaseCard key={reviewCase.id} reviewCase={reviewCase} actions />
            ))}
          </ul>
        )}
      </section>

      {decided.length > 0 && (
        <section>
          <h2 className="text-lg font-medium">Recently decided</h2>
          <ul className="mt-3 space-y-4">
            {decided.map((reviewCase) => (
              <CaseCard key={reviewCase.id} reviewCase={reviewCase} actions={false} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
