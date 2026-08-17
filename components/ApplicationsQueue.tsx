"use client";

import { useCallback, useEffect, useState } from "react";

interface QueueApplication {
  id: string;
  status: string;
  proposedHandle: string;
  proposedName: string;
  proposedKind: string;
  youtubeChannelId: string | null;
  ministryStatement: string;
  submittedAt: string | null;
  user: { email: string; name: string | null };
  vouches: { voucherChannel: { handle: string; name: string } }[];
}

export function ApplicationsQueue() {
  const [applications, setApplications] = useState<QueueApplication[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/applications");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setApplications((await res.json()).applications);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(applicationId: string, action: "approve" | "reject") {
    let note: string | undefined;
    if (action === "reject") {
      note = window.prompt("Decision note (required — shown to the applicant):") ?? undefined;
      if (!note || note.trim().length < 10) return;
    }
    setBusyId(applicationId);
    try {
      const res = await fetch("/api/admin/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, applicationId, ...(note ? { note } : {}) }),
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

  if (error) return <p className="mt-6 text-sm text-red-600">{error}</p>;
  if (!applications) return <p className="mt-6 text-sm text-neutral-500">Loading…</p>;
  if (applications.length === 0) {
    return <p className="mt-6 text-sm text-neutral-500">The queue is empty.</p>;
  }

  return (
    <ul className="mt-6 space-y-4">
      {applications.map((app) => (
        <li
          key={app.id}
          className="rounded-xl border border-neutral-200 p-6 dark:border-neutral-800"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium">
                {app.proposedName}{" "}
                <span className="text-sm text-neutral-500">
                  @{app.proposedHandle} · {app.proposedKind}
                </span>
              </p>
              <p className="text-sm text-neutral-500">
                {app.user.name ?? "—"} · {app.user.email}
                {app.youtubeChannelId && <> · YT: {app.youtubeChannelId}</>}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => void act(app.id, "approve")}
                disabled={busyId === app.id}
                className="rounded-lg bg-neutral-900 hover:bg-orange-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
              >
                Approve
              </button>
              <button
                onClick={() => void act(app.id, "reject")}
                disabled={busyId === app.id}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-neutral-700"
              >
                Reject
              </button>
            </div>
          </div>
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            {app.ministryStatement}
          </p>
          {app.vouches.length > 0 && (
            <p className="mt-3 text-xs text-neutral-500">
              Vouched by:{" "}
              {app.vouches.map((v) => `@${v.voucherChannel.handle}`).join(", ")}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
