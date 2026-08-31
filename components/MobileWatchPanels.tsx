"use client";

// Mobile watch page, YouTube-app style: below the sticky player, the
// related-videos list scrolls by default; tapping the Comments bar swaps
// the area to the comments panel, ✕ swaps back to the videos.

import { useState } from "react";

export function MobileWatchPanels({
  related,
  comments,
}: {
  related: React.ReactNode;
  comments: React.ReactNode;
}) {
  const [showComments, setShowComments] = useState(false);

  if (showComments) {
    return (
      <section className="mt-4">
        <div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
          <span className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Comments
          </span>
          <button
            aria-label="Close comments"
            onClick={() => setShowComments(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
          >
            ✕
          </button>
        </div>
        <div className="[&_h2]:hidden">{comments}</div>
      </section>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowComments(true)}
        className="mt-4 flex w-full items-center justify-between rounded-xl bg-neutral-100 px-4 py-3 text-left transition-colors active:bg-amber-100 dark:bg-neutral-800 dark:active:bg-amber-950/40"
      >
        <span>
          <span className="text-sm font-semibold">Comments</span>
          <span className="ml-2 text-xs text-neutral-500">
            Join the conversation
          </span>
        </span>
        <span aria-hidden className="text-neutral-400">
          →
        </span>
      </button>
      <div className="mt-6">{related}</div>
    </>
  );
}
