"use client";

// Watch-page comments: live immediately, moderated after the fact
// (safety/abuse — doctrinal concerns go through the report flow instead).

import { useCallback, useEffect, useState } from "react";

interface CommentRow {
  id: string;
  body: string;
  createdAt: string;
  user: { name: string | null; imageUrl: string | null };
}

export function Comments({ contentItemId }: { contentItemId: string }) {
  const [comments, setComments] = useState<CommentRow[] | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?contentItemId=${contentItemId}`);
      if (res.ok) setComments((await res.json()).comments);
    } catch {
      // comments are best-effort chrome
    }
  }, [contentItemId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function post() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentItemId, body }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setError("Sign in to join the conversation.");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      setBody("");
      setComments((prev) => [data.comment, ...(prev ?? [])]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Comments
        {comments && comments.length > 0 && (
          <span className="ml-2 font-normal normal-case tracking-normal text-neutral-400">
            {comments.length}
          </span>
        )}
      </h2>

      <div className="mt-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          maxLength={2000}
          placeholder="Add a comment — charitable, on the teaching."
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
        <button
          onClick={() => void post()}
          disabled={busy || body.trim().length < 2}
          className="mt-2 rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
        >
          {busy ? "Posting…" : "Comment"}
        </button>
      </div>

      <ul className="mt-6 space-y-5">
        {(comments ?? []).map((comment) => (
          <li key={comment.id} className="flex gap-3">
            {comment.user.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={comment.user.imageUrl}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-amber-500 to-orange-600 text-xs font-semibold text-white">
                {(comment.user.name ?? "?").charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-xs text-neutral-500">
                <span className="font-medium text-neutral-800 dark:text-neutral-200">
                  {comment.user.name ?? "A viewer"}
                </span>{" "}
                · {new Date(comment.createdAt).toLocaleDateString()}
              </p>
              <p className="mt-0.5 whitespace-pre-line text-sm leading-6">
                {comment.body}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
