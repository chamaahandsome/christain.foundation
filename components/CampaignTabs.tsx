"use client";

// Story / Updates tabs on the public campaign page. Both panels arrive
// pre-sanitized from the server; this component only switches between them.

import { useState } from "react";

export interface CampaignUpdateView {
  id: string;
  title: string;
  bodyHtml: string; // sanitized server-side
  date: string; // preformatted
  backersOnly: boolean;
}

export function CampaignTabs({
  storyHtml, // sanitized server-side, null when no story
  updates,
}: {
  storyHtml: string | null;
  updates: CampaignUpdateView[];
}) {
  const [tab, setTab] = useState<"story" | "updates">(
    storyHtml ? "story" : "updates",
  );

  const pill = (active: boolean) =>
    `rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
      active
        ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
        : "bg-neutral-100 text-neutral-700 hover:bg-amber-100 hover:text-amber-900 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-amber-950 dark:hover:text-amber-300"
    }`;

  return (
    <section className="mt-8">
      <div className="flex gap-2 border-b border-neutral-200 pb-3 dark:border-neutral-800">
        <button onClick={() => setTab("story")} className={pill(tab === "story")}>
          Story
        </button>
        <button onClick={() => setTab("updates")} className={pill(tab === "updates")}>
          Updates{updates.length > 0 && ` (${updates.length})`}
        </button>
      </div>

      {tab === "story" &&
        (storyHtml ? (
          <div
            className="prose-reader mt-5 text-[15px] leading-7 text-neutral-700 dark:text-neutral-300"
            dangerouslySetInnerHTML={{ __html: storyHtml }}
          />
        ) : (
          <p className="mt-5 text-sm text-neutral-500">
            The full story hasn&apos;t been written yet.
          </p>
        ))}

      {tab === "updates" &&
        (updates.length > 0 ? (
          <div className="mt-5 space-y-5">
            {updates.map((u) => (
              <article
                key={u.id}
                className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-medium">{u.title}</h3>
                  <time className="shrink-0 text-xs text-neutral-500">{u.date}</time>
                </div>
                <div
                  className="prose-reader mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400"
                  dangerouslySetInnerHTML={{ __html: u.bodyHtml }}
                />
                {u.backersOnly && (
                  <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-amber-600">
                    Backers only
                  </p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-neutral-500">
            No updates yet — pledges will hear here first.
          </p>
        ))}
    </section>
  );
}
