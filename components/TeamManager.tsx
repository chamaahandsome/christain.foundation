"use client";

// Team roster management: invite by email with per-feature access, copy the
// accept link (no transactional email yet), edit access, suspend, remove.

import { useCallback, useEffect, useState } from "react";

const FEATURES = ["library", "team", "analytics", "settings"] as const;
const LEVELS = ["none", "viewer", "manager"] as const;

type FeatureAccess = Record<string, string>;

interface Member {
  id: string;
  email: string;
  userId: string | null;
  user: { name: string | null; imageUrl: string | null } | null;
  featureAccess: FeatureAccess;
  status: "PENDING" | "ACTIVE" | "SUSPENDED";
  invitedAt: string;
  acceptedAt: string | null;
  inviteToken?: string | null;
  inviteExpiresAt: string | null;
}

const DEFAULT_ACCESS: FeatureAccess = {
  library: "manager",
  team: "none",
  analytics: "viewer",
  settings: "none",
};

export function TeamManager({ channelId }: { channelId: string }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [access, setAccess] = useState<FeatureAccess>(DEFAULT_ACCESS);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/studio/team?channelId=${channelId}`);
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
      const data = await res.json();
      setMembers(data.members);
      setIsOwner(data.isOwner);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [channelId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function call(method: string, body: unknown): Promise<boolean> {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/studio/team", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return false;
      }
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function invite() {
    if (await call("POST", { channelId, email, featureAccess: access })) {
      setEmail("");
      setAccess(DEFAULT_ACCESS);
      setNotice("Invitation created — copy the link from the roster below and send it.");
    }
  }

  async function copyLink(token: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/team/accept/${token}`);
    setNotice("Accept link copied.");
  }

  if (error && !members) return <p className="mt-6 text-sm text-red-600">{error}</p>;
  if (!members) return <p className="mt-6 text-sm text-neutral-500">Loading…</p>;

  return (
    <div className="mt-6 space-y-8">
      {isOwner && (
        <section className="rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
          <h2 className="text-lg font-medium">Invite someone</h2>
          <div className="mt-3">
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              placeholder="staff@ministry.org"
            />
          </div>
          <AccessEditor access={access} onChange={setAccess} />
          <button
            onClick={() => void invite()}
            disabled={busy || !email}
            className="mt-4 rounded-lg bg-neutral-900 hover:bg-orange-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
          >
            Create invitation
          </button>
        </section>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-neutral-500">{notice}</p>}

      <section>
        <h2 className="text-lg font-medium">Roster</h2>
        {members.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No team members yet.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {members.map((member) => (
              <li
                key={member.id}
                className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {member.user?.name ?? member.email}{" "}
                      <span className="ml-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium uppercase text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                        {member.status}
                      </span>
                    </p>
                    <p className="text-sm text-neutral-500">{member.email}</p>
                  </div>
                  {isOwner && (
                    <div className="flex flex-wrap gap-2">
                      {member.status === "PENDING" && member.inviteToken && (
                        <button
                          onClick={() => void copyLink(member.inviteToken!)}
                          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
                        >
                          Copy invite link
                        </button>
                      )}
                      {member.status === "ACTIVE" && (
                        <button
                          onClick={() =>
                            void call("PATCH", { memberId: member.id, status: "SUSPENDED" })
                          }
                          disabled={busy}
                          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-neutral-700"
                        >
                          Suspend
                        </button>
                      )}
                      {member.status === "SUSPENDED" && (
                        <button
                          onClick={() =>
                            void call("PATCH", { memberId: member.id, status: "ACTIVE" })
                          }
                          disabled={busy}
                          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-neutral-700"
                        >
                          Reactivate
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (window.confirm(`Remove ${member.email} from the team?`)) {
                            void call("DELETE", { memberId: member.id });
                          }
                        }}
                        disabled={busy}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 disabled:opacity-50 dark:border-red-900"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
                {isOwner ? (
                  <AccessEditor
                    access={{ ...member.featureAccess }}
                    onChange={(next) =>
                      void call("PATCH", { memberId: member.id, featureAccess: next })
                    }
                    compact
                  />
                ) : (
                  <p className="mt-3 text-xs text-neutral-500">
                    {FEATURES.filter((f) => (member.featureAccess[f] ?? "none") !== "none")
                      .map((f) => `${f}: ${member.featureAccess[f]}`)
                      .join(" · ") || "No access granted."}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function AccessEditor({
  access,
  onChange,
  compact,
}: {
  access: FeatureAccess;
  onChange: (next: FeatureAccess) => void;
  compact?: boolean;
}) {
  return (
    <div className={`mt-3 grid gap-2 ${compact ? "sm:grid-cols-4" : "sm:grid-cols-2"}`}>
      {FEATURES.map((feature) => (
        <label key={feature} className="text-sm">
          <span className="mb-1 block font-medium capitalize">{feature}</span>
          <select
            value={access[feature] ?? "none"}
            onChange={(e) => onChange({ ...access, [feature]: e.target.value })}
            className="w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}
