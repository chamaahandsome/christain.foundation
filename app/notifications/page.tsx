"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";

interface NotificationRow {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
  readAt: string | null;
  createdAt: string;
}

// Inlined at build time; SignedIn/SignedOut may only render when the root
// layout mounted ClerkProvider (same degraded no-keys mode as SiteHeader).
const hasClerkKeys = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function NotificationsPage() {
  if (!hasClerkKeys) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-center text-sm text-neutral-500">
          Notifications require sign-in, which isn't configured yet.
        </p>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <SignedOut>
        <div className="text-center">
          <p className="text-sm text-neutral-500">Sign in to see notifications.</p>
          <SignInButton mode="modal">
            <button className="mt-4 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900">
              Sign in
            </button>
          </SignInButton>
        </div>
      </SignedOut>
      <SignedIn>
        <NotificationsList />
      </SignedIn>
    </main>
  );
}

function NotificationsList() {
  const [rows, setRows] = useState<NotificationRow[] | null>(null);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (res.ok) {
      const data = await res.json();
      setRows(data.notifications);
      setUnread(data.unread);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    await load();
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
          Updates
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Notifications</h1>
        {unread > 0 && (
          <button onClick={() => void markAllRead()} className="text-sm underline">
            Mark all read ({unread})
          </button>
        )}
      </div>
      {!rows ? (
        <p className="mt-6 text-sm text-neutral-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">Nothing yet.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {rows.map((row) => {
            const inner = (
              <div
                className={`rounded-xl border px-4 py-3 ${
                  row.readAt
                    ? "border-neutral-200 dark:border-neutral-800"
                    : "border-neutral-800 bg-neutral-50 dark:border-neutral-200 dark:bg-neutral-900"
                }`}
              >
                <p className="text-sm font-medium">{row.title}</p>
                {row.body && (
                  <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{row.body}</p>
                )}
                <p className="mt-1 text-xs text-neutral-400">
                  {new Date(row.createdAt).toLocaleString()}
                </p>
              </div>
            );
            return (
              <li key={row.id}>
                {row.url ? <Link href={row.url}>{inner}</Link> : inner}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
