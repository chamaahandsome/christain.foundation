"use client";

// The Start Here pathway as a tabbed experience: pills, Back, and Next swap
// the topic in place — no page navigation. The URL follows via pushState so
// deep links and refresh land on the same question (the server page renders
// any /start/{slug} directly).

import Link from "next/link";
import { useEffect, useState } from "react";
import { StartHereVideoCard } from "@/components/StartHereVideoCard";
import { isPlaceholderVideo, type StartHereTopic } from "@/lib/start-here";

const PILL_WINDOW = 4;

function TierBadge({ tier, note }: { tier: string; note: string }) {
  const essential = tier === "essential";
  return (
    <p className="flex flex-wrap items-center gap-3">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
          essential
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
            : "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
        }`}
      >
        {essential ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="5" r="3" />
            <path d="M12 8v13M5 12H2a10 10 0 0 0 20 0h-3" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12Z" />
          </svg>
        )}
        {essential ? "Essential" : "Open question"}
      </span>
      <span className="text-sm text-neutral-500">{note}</span>
    </p>
  );
}

export function StartHerePathway({
  topics,
  initialSlug,
}: {
  topics: StartHereTopic[];
  initialSlug: string;
}) {
  const [slug, setSlug] = useState(initialSlug);

  const index = Math.max(
    0,
    topics.findIndex((t) => t.slug === slug),
  );
  const topic = topics[index];
  const prevTopic = index > 0 ? topics[index - 1] : null;
  const nextTopic = index + 1 < topics.length ? topics[index + 1] : null;

  function goTo(nextSlug: string) {
    setSlug(nextSlug);
    window.history.pushState(null, "", `/start/${nextSlug}`);
    window.scrollTo({ top: 0 });
  }

  // Browser back/forward stays inside the tabs.
  useEffect(() => {
    function onPop() {
      const match = window.location.pathname.match(/\/start\/([^/]+)/);
      if (match && topics.some((t) => t.slug === match[1])) {
        setSlug(match[1]);
      }
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [topics]);

  const videos = [...topic.videos]
    .sort((a, b) => a.order - b.order)
    .filter((video) => !isPlaceholderVideo(video));

  const windowPills = topics.slice(index, index + PILL_WINDOW);
  const remaining = topics.length - (index + windowPills.length);

  return (
    <>
      {/* Progress strip */}
      <nav aria-label="Pathway progress" className="mb-5 flex flex-wrap items-center gap-2">
        {windowPills.map((t) => (
          <button
            key={t.slug}
            type="button"
            onClick={() => goTo(t.slug)}
            aria-current={t.slug === topic.slug ? "page" : undefined}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              t.slug === topic.slug
                ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                : "bg-neutral-100 text-neutral-700 hover:bg-amber-100 hover:text-amber-900 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-amber-950 dark:hover:text-amber-300"
            }`}
          >
            {t.order}. {t.label}
          </button>
        ))}
        {remaining > 0 && (
          <Link
            href="/start"
            className="rounded-xl bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
          >
            +{remaining} more
          </Link>
        )}
      </nav>

      {/* The panel */}
      <article
        key={topic.slug}
        className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-10 dark:border-neutral-800 dark:bg-neutral-900/60"
      >
        <TierBadge tier={topic.tier} note={topic.tier_note} />

        <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          {topic.question}
        </h1>

        <p className="mt-4 text-pretty text-base leading-8 text-neutral-700 dark:text-neutral-300">
          {topic.framing}
        </p>

        <div className="mt-8 space-y-6">
          {videos.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
              The teaching for this question is being hand-picked. Check back
              soon.
            </p>
          ) : (
            videos.map((video) => (
              <StartHereVideoCard
                key={`${video.youtube_id}-${video.order}`}
                video={video}
              />
            ))
          )}
        </div>

        <hr className="mt-10 border-neutral-200 dark:border-neutral-800" />

        <div className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <p className="max-w-xs text-xs leading-5 text-neutral-400">
            Videos are hosted on YouTube and belong to their creators. CF is
            not affiliated with or endorsed by them.
          </p>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {prevTopic && (
              <button
                type="button"
                onClick={() => goTo(prevTopic.slug)}
                className="group inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-base font-medium text-neutral-500 hover:bg-amber-50 hover:text-amber-900 dark:hover:bg-amber-950/40 dark:hover:text-amber-300"
              >
                <span aria-hidden className="transition-transform group-hover:-translate-x-1">
                  ←
                </span>
                Back
              </button>
            )}
            {nextTopic ? (
              <button
                type="button"
                onClick={() => goTo(nextTopic.slug)}
                className="group inline-flex items-center gap-2 rounded-2xl border border-neutral-300 px-6 py-3 text-base font-medium hover:border-amber-500 hover:bg-amber-50 dark:border-neutral-700 dark:hover:border-amber-600 dark:hover:bg-amber-950/40"
              >
                Next: {nextTopic.question.replace(/\?$/, "").toLowerCase()}
                <span aria-hidden className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </button>
            ) : (
              <Link
                href="/map"
                className="group inline-flex items-center gap-2 rounded-2xl border border-neutral-300 px-6 py-3 text-base font-medium hover:border-amber-500 hover:bg-amber-50 dark:border-neutral-700 dark:hover:border-amber-600 dark:hover:bg-amber-950/40"
              >
                Next: explore the map
                <span aria-hidden className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
            )}
          </div>
        </div>
      </article>
    </>
  );
}
