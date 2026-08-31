"use client";

// The creator's signature, visible (concept §5): a quiet badge on the
// channel header; clicking slides out the full statement of faith they
// affirmed — clause by clause, with version and date. Shown only when the
// owner has affirmed the current published statement in full.

import { useEffect, useState } from "react";

interface Clause {
  key: string;
  title: string;
  text: string;
}

export function StatementBadge({
  channelName,
  version,
  title,
  preamble,
  clauses,
  affirmedOn,
}: {
  channelName: string;
  version: number;
  title: string;
  preamble: string;
  clauses: Clause[];
  affirmedOn: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 transition-colors hover:border-amber-500 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-950"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5"
          aria-hidden
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        Affirms the Statement of Faith
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Statement of faith affirmed by ${channelName}`}
        >
          <aside
            className="h-full w-full max-w-md overflow-y-auto bg-white p-6 text-left shadow-2xl dark:bg-neutral-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
                  Affirmed by {channelName}
                </p>
                <h2 className="mt-1 text-xl font-semibold">{title}</h2>
              </div>
              <button
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
              >
                ✕
              </button>
            </div>

            <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              {preamble}
            </p>

            <ul className="mt-6 space-y-4">
              {clauses.map((clause) => (
                <li key={clause.key} className="flex gap-3">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                    aria-hidden
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3 w-3"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                  <div>
                    <p className="text-sm font-medium">{clause.title}</p>
                    <p className="mt-0.5 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                      {clause.text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-8 border-t border-neutral-200 pt-4 text-xs leading-5 text-neutral-500 dark:border-neutral-800">
              Affirmed in its plain, historic sense on{" "}
              {new Date(affirmedOn).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}{" "}
              · Statement version {version}. Every CF creator signs this
              statement clause by clause before publishing, and their
              published teaching remains accountable to it.
            </p>
          </aside>
        </div>
      )}
    </>
  );
}
