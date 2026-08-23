"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface ModComment {
  id: string;
  body: string;
  status: string;
  createdAt: string;
  user: { name: string | null; email: string };
  contentItem: { id: string; title: string };
}

const STATUS_STYLES: Record<string, string> = {
  APPROVED: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  HIDDEN: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  REMOVED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  PENDING: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
};

export function ModerationQueue() {
  const [comments, setComments] = useState<ModComment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/moderation");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setComments((await res.json()).comments);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setStatus(commentId: string, status: string) {
    setBusyId(commentId);
    try {
      const res = await fetch("/api/admin/moderation", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ commentId, status }),
      });
      if (!res.ok) {
        window.alert((await res.json()).error ?? `Failed (${res.status})`);
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (error) return <p className="mt-6 text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (!comments) return <p className="mt-6 text-sm text-neutral-500">Loading…</p>;
  if (comments.length === 0) {
    return <p className="mt-6 text-sm text-neutral-500">No comments yet.</p>;
  }

  return (
    <ul className="mt-6 space-y-4">
      {comments.map((comment) => (
        <li
          key={comment.id}
          className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm">
                <span className="font-medium">{comment.user.name ?? comment.user.email}</span>{" "}
                <span
                  className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium uppercase ${STATUS_STYLES[comment.status] ?? ""}`}
                >
                  {comment.status}
                </span>
              </p>
              <p className="text-xs text-neutral-500">
                on{" "}
                <Link
                  href={`/watch/${comment.contentItem.id}`}
                  className="underline"
                  target="_blank"
                >
                  {comment.contentItem.title}
                </Link>{" "}
                · {new Date(comment.createdAt).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2">
              {comment.status !== "APPROVED" && (
                <button
                  onClick={() => void setStatus(comment.id, "APPROVED")}
                  disabled={busyId === comment.id}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-neutral-700"
                >
                  Approve
                </button>
              )}
              {comment.status !== "HIDDEN" && (
                <button
                  onClick={() => void setStatus(comment.id, "HIDDEN")}
                  disabled={busyId === comment.id}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-neutral-700"
                >
                  Hide
                </button>
              )}
              {comment.status !== "REMOVED" && (
                <button
                  onClick={() => void setStatus(comment.id, "REMOVED")}
                  disabled={busyId === comment.id}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 disabled:opacity-50 dark:border-red-900 dark:text-red-400"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            {comment.body}
          </p>
        </li>
      ))}
    </ul>
  );
}
