"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Clause {
  key: string;
  title: string;
  text: string;
}

export function AffirmForm({
  clauses,
  missing,
}: {
  clauses: Clause[];
  missing: string[];
}) {
  const router = useRouter();
  const missingSet = new Set(missing);
  const [affirmed, setAffirmed] = useState<Set<string>>(
    new Set(clauses.map((c) => c.key).filter((key) => !missingSet.has(key))),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/affirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ affirmClauses: Array.from(affirmed) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {clauses.map((clause) => {
        const isNew = missingSet.has(clause.key);
        return (
          <label
            key={clause.key}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${
              isNew
                ? "border-amber-400 dark:border-amber-700"
                : "border-neutral-200 dark:border-neutral-800"
            }`}
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
              <span className="font-medium">
                {clause.title}
                {isNew && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    needs your signature
                  </span>
                )}
              </span>
              <span className="mt-1 block text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                {clause.text}
              </span>
            </span>
          </label>
        );
      })}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        onClick={() => void submit()}
        disabled={busy || affirmed.size < clauses.length}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
      >
        {busy ? "Recording…" : "Affirm the statement"}
      </button>
      <p className="text-xs text-neutral-500">
        The button enables when every clause is checked — affirmation is
        all-or-nothing, in the plain, historic sense of the words.
      </p>
    </div>
  );
}
