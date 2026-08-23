"use client";

// YouTube ownership verification (settings tab). Two paths: instant Google
// check via the Clerk-held OAuth token, or the paste-a-code-in-your-
// description fallback that covers Brand Accounts.

import { useState } from "react";
import { useRouter } from "next/navigation";

export function YouTubeVerifyCard({
  channelId,
  youtubeChannelId,
  verifiedAt,
  verifiedVia,
}: {
  channelId: string;
  youtubeChannelId: string | null;
  verifiedAt: string | null;
  verifiedVia: string | null;
}) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function call(action: "start" | "check_description" | "check_google") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch("/api/studio/verify-youtube", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channelId, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      if (data.token) setToken(data.token);
      if (data.verified) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (!youtubeChannelId) return null;

  if (verifiedAt) {
    return (
      <section className="mt-8 rounded-xl border border-green-200 bg-green-50 p-5 dark:border-green-900 dark:bg-green-950/40">
        <p className="text-sm font-medium text-green-800 dark:text-green-300">
          YouTube channel verified
          {verifiedVia === "google" ? " via Google" : " via channel description"}{" "}
          — {new Date(verifiedAt).toLocaleDateString()}.
        </p>
        <p className="mt-1 text-xs text-green-700 dark:text-green-400">
          {youtubeChannelId} is yours to import. Relinking a different channel
          restarts verification.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-xl border border-amber-400 bg-amber-50 p-5 dark:border-amber-700 dark:bg-amber-950/40">
      <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
        Verify YouTube ownership
      </h2>
      <p className="mt-1 text-sm leading-6 text-amber-800 dark:text-amber-300">
        Importing requires proof that {youtubeChannelId} is your channel — a
        library belongs to its creator.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <button
            onClick={() => void call("check_google")}
            disabled={busy !== null}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
          >
            {busy === "check_google" ? "Checking…" : "Verify with Google"}
          </button>
          <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-400">
            Instant, if you sign in to CF with the Google account that owns the
            channel.
          </p>
        </div>

        <div className="border-t border-amber-300/60 pt-4 dark:border-amber-800">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            Or: paste a code into your channel description
          </p>
          {!token ? (
            <button
              onClick={() => void call("start")}
              disabled={busy !== null}
              className="mt-2 rounded-lg border border-amber-500 px-4 py-2 text-sm font-medium text-amber-900 disabled:opacity-50 dark:border-amber-600 dark:text-amber-200"
            >
              {busy === "start" ? "Generating…" : "Generate verification code"}
            </button>
          ) : (
            <div className="mt-2">
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded-lg bg-white px-3 py-1.5 font-mono text-sm dark:bg-neutral-900">
                  {token}
                </code>
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(token);
                    setCopied(true);
                  }}
                  className="rounded-lg border border-amber-500 px-3 py-1.5 text-xs dark:border-amber-600"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-5 text-amber-800 dark:text-amber-300">
                <li>
                  On YouTube: Customization → Basic info → add this code
                  anywhere in your channel description, and publish.
                </li>
                <li>Come back and click the button below. You can remove the code after.</li>
              </ol>
              <button
                onClick={() => void call("check_description")}
                disabled={busy !== null}
                className="mt-3 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
              >
                {busy === "check_description" ? "Checking…" : "I've added it — verify"}
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </section>
  );
}
