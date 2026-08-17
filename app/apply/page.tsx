"use client";

// The creator application (concept §5): read the statement, affirm each
// clause deliberately, describe the ministry, agree to the conduct standard,
// submit. Validation logic lives in lib/gate + lib/handles (tested); this is
// a thin surface over it.

import { useCallback, useEffect, useState } from "react";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { validateHandle } from "@/lib/handles";

interface Clause {
  key: string;
  title: string;
  text: string;
}

interface ApplyState {
  statement: {
    version: number;
    title: string;
    preamble: string;
    clauses: Clause[];
  };
  application: {
    id: string;
    status: string;
    proposedHandle: string;
    proposedName: string;
    proposedKind: string;
    youtubeChannelId: string | null;
    ministryStatement: string;
    conductAgreedAt: string | null;
    inviteCode: { code: string } | null;
    vouches: { voucherChannel: { handle: string; name: string } }[];
  } | null;
  affirmation: { complete: boolean; missing: string[] };
}

const KINDS = [
  "TEACHER",
  "PASTOR",
  "MISSIONARY",
  "MUSICIAN",
  "FILMMAKER",
  "AUTHOR",
  "PODCASTER",
  "ORGANIZER",
  "RESEARCHER",
  "ARCHAEOLOGIST",
  "MINISTRY",
] as const;

const CONDUCT_SUMMARY = `Financial integrity: transparent use of funds, no prosperity-gospel solicitation, no manipulative giving appeals. No attacking fellow believers: critique of public teaching, by name, is legitimate discernment; attacks on the person — motives, character, mockery — are disqualifying. This is a standing obligation, not a one-time question.`;

// Inlined at build time; SignedIn/SignedOut may only render when the root
// layout mounted ClerkProvider (same degraded no-keys mode as SiteHeader).
const hasClerkKeys = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

export default function ApplyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        The creator gate
      </p>
      <h1 className="mt-2 text-3xl font-semibold">Become a creator</h1>
      <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
        Anyone can watch. Not anyone can publish. We vet by affirmation, not by
        affiliation — we don't ask what tradition you belong to; we ask what
        you affirm.
      </p>
      {hasClerkKeys ? (
        <>
          <SignedOut>
            <div className="mt-8 rounded-xl border border-neutral-200 p-6 text-center dark:border-neutral-800">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Sign in to begin your application.
              </p>
              <SignInButton mode="modal">
                <button className="mt-4 rounded-lg bg-neutral-900 hover:bg-orange-600 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white">
                  Sign in
                </button>
              </SignInButton>
            </div>
          </SignedOut>
          <SignedIn>
            <ApplyForm />
          </SignedIn>
        </>
      ) : (
        <p className="mt-8 text-sm text-neutral-500">
          Applications open once sign-in is configured.
        </p>
      )}
    </main>
  );
}

function ApplyForm() {
  const [state, setState] = useState<ApplyState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<string>("TEACHER");
  const [youtube, setYoutube] = useState("");
  const [ministry, setMinistry] = useState("");
  const [affirmed, setAffirmed] = useState<Set<string>>(new Set());
  const [conduct, setConduct] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [copied, setCopied] = useState(false);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/apply");
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const data: ApplyState = await res.json();
      setState(data);
      if (data.application) {
        setHandle(data.application.proposedHandle);
        setName(data.application.proposedName);
        setKind(data.application.proposedKind);
        setYoutube(data.application.youtubeChannelId ?? "");
        setMinistry(data.application.ministryStatement);
        setConduct(Boolean(data.application.conductAgreedAt));
      }
      const affirmedKeys = data.statement.clauses
        .map((c) => c.key)
        .filter((key) => !data.affirmation.missing.includes(key));
      if (data.affirmation.complete || affirmedKeys.length > 0) {
        setAffirmed(new Set(data.affirmation.complete ? data.statement.clauses.map((c) => c.key) : affirmedKeys));
      }
    } catch (err) {
      setLoadError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loadError) {
    return (
      <p className="mt-8 text-sm text-red-600">
        Could not load the application: {loadError}
      </p>
    );
  }
  if (!state) {
    return <p className="mt-8 text-sm text-neutral-500">Loading…</p>;
  }

  const status = state.application?.status ?? "DRAFT";
  if (status === "SUBMITTED" || status === "UNDER_REVIEW") {
    return (
      <div className="mt-8 rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
        <p className="font-medium">Your application is in review.</p>
        <p className="mt-1 text-sm text-neutral-500">
          We review the teaching, not the paperwork — this may take a little
          time. You'll hear from us either way, and a rejection is never
          arbitrary.
        </p>
      </div>
    );
  }

  const handleCheck = handle ? validateHandle(handle) : { valid: false };

  async function saveDraft(): Promise<boolean> {
    setBusy(true);
    setMessage(null);
    setErrors([]);
    try {
      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          proposedHandle: handle,
          proposedName: name,
          proposedKind: kind,
          youtubeChannelId: youtube || undefined,
          ministryStatement: ministry,
          affirmClauses: Array.from(affirmed),
          agreeConduct: conduct,
          ...(inviteCode.trim() ? { inviteCode: inviteCode.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors([data.error ?? "Could not save draft."]);
        return false;
      }
      if (data.inviteCodeError) {
        setErrors([`Draft saved, but the invitation code wasn't accepted: ${data.inviteCodeError}`]);
      } else {
        setMessage("Draft saved.");
      }
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!(await saveDraft())) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/apply/submit", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.details ?? [data.error ?? "Could not submit."]);
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-10">
      {/* The doctrinal statement — affirmed clause by clause */}
      <section>
        <h2 className="text-xl font-semibold">{state.statement.title}</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
          {state.statement.preamble}
        </p>
        <div className="mt-4 space-y-3">
          {state.statement.clauses.map((clause) => (
            <label
              key={clause.key}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={affirmed.has(clause.key)}
                onChange={(e) => {
                  const next = new Set(affirmed);
                  if (e.target.checked) next.add(clause.key);
                  else next.delete(clause.key);
                  setAffirmed(next);
                }}
              />
              <span>
                <span className="font-medium">{clause.title}</span>
                <span className="mt-1 block text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                  {clause.text}
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* Channel details */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Your channel</h2>
        <div>
          <label className="mb-1 block text-sm font-medium">Channel name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            placeholder="Grace Chapel Teaching"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Handle</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-500">@</span>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase())}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              placeholder="grace.chapel"
            />
          </div>
          {handle && !handleCheck.valid && (
            <p className="mt-1 text-xs text-red-600">
              {"error" in handleCheck ? handleCheck.error : "Invalid handle."}
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">What kind of creator are you?</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k.charAt(0) + k.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            YouTube channel (optional — we'll bring your library over)
          </label>
          <input
            value={youtube}
            onChange={(e) => setYoutube(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            placeholder="@yourhandle or UC… channel id"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            Who are you, and what do you teach?
          </label>
          <textarea
            value={ministry}
            onChange={(e) => setMinistry(e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            placeholder="Your ministry, your history, what your channel will carry. (At least 50 characters.)"
          />
        </div>
      </section>

      {/* Conduct */}
      <section>
        <h2 className="text-xl font-semibold">The conduct standard</h2>
        <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
          <input
            type="checkbox"
            className="mt-1"
            checked={conduct}
            onChange={(e) => setConduct(e.target.checked)}
          />
          <span className="text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            {CONDUCT_SUMMARY} <span className="font-medium">I agree.</span>
          </span>
        </label>
      </section>

      {/* Vouching (§5.3) — or a founding-cohort invitation code */}
      <section>
        <h2 className="text-xl font-semibold">Vouching</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
          An approved creator who knows you or your ministry vouches for your
          application. If you were invited directly, redeem your invitation
          code instead.
        </p>
        {state.application?.vouches && state.application.vouches.length > 0 && (
          <p className="mt-3 text-sm text-green-600 dark:text-green-400">
            Vouched for by{" "}
            {state.application.vouches
              .map((v) => `${v.voucherChannel.name} (@${v.voucherChannel.handle})`)
              .join(", ")}
            .
          </p>
        )}
        {state.application && (
          <div className="mt-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <p className="text-sm font-medium">Ask a creator to vouch for you</p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Share this link with an approved creator who knows you:
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs dark:bg-neutral-900">
                {`${typeof window !== "undefined" ? window.location.origin : ""}/vouch/${state.application.id}`}
              </code>
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(
                    `${window.location.origin}/vouch/${state.application!.id}`,
                  );
                  setCopied(true);
                }}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs dark:border-neutral-700"
              >
                {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          </div>
        )}
        <div className="mt-3">
          {state.application?.inviteCode ? (
            <p className="text-sm text-green-600 dark:text-green-400">
              Invitation code {state.application.inviteCode.code} redeemed — you
              can submit without a vouch.
            </p>
          ) : (
            <>
              <label className="mb-1 block text-sm font-medium">
                Invitation code (if you have one)
              </label>
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-900"
                placeholder="CF-XXXX-XXXX"
              />
              <p className="mt-1 text-xs text-neutral-500">
                Redeemed when you save your draft.
              </p>
            </>
          )}
        </div>
      </section>

      {errors.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {errors.map((error, i) => (
            <li key={i}>{error}</li>
          ))}
        </ul>
      )}
      {message && <p className="text-sm text-neutral-500">{message}</p>}

      <div className="flex gap-3">
        <button
          onClick={() => void saveDraft()}
          disabled={busy}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-neutral-700"
        >
          Save draft
        </button>
        <button
          onClick={() => void submit()}
          disabled={busy}
          className="rounded-lg bg-neutral-900 hover:bg-orange-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
        >
          Submit for review
        </button>
      </div>
    </div>
  );
}
