"use client";

// A word on who is teaching. Start Here draws on teachers across the body of
// Christ, and a new believer should know two things before pressing play:
// we don't endorse every doctrine each one holds, and the disagreements
// they'll hear between them are normal. What they share is the faith itself.
//
// Rolled up, the card is only its heading, so it never crowds the step. The
// open/closed state lives in StartHereFrame, which also moves the step aside.

import Link from "next/link";
import { useId } from "react";

export function StartHereTeachersNote({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const headingId = useId();
  const bodyId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-6 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400"
    >
      <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
        About these teachers
      </p>
      {/* Heading and toggle share a line, so the rolled-up card stays short. */}
      <div className="flex items-center justify-between gap-3">
        <h2
          id={headingId}
          className="min-w-0 text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100"
        >
          One body, many voices
        </h2>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={bodyId}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-amber-700 hover:underline dark:text-amber-400"
        >
          {expanded ? "Collapse" : "Expand"}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={`h-4 w-4 transition-transform duration-500 motion-reduce:transition-none ${
              expanded ? "rotate-180" : ""
            }`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>

      {/* The full note. grid-rows 0fr → 1fr opens it to its natural height;
          while closed it's hidden from keyboard and screen readers too. */}
      <div
        id={bodyId}
        className={`grid transition-[grid-template-rows] duration-500 ease-out motion-reduce:transition-none ${
          expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden" aria-hidden={!expanded}>
          <p className="pt-2">
            These videos come from teachers across the body of Christ. We
            don&apos;t endorse everything each of them teaches, but we believe
            every one holds to the core doctrines of the Christian faith. They
            align with our doctrinal statement.
          </p>
          <p className="mt-3">
            They won&apos;t agree on everything. Some are Calvinists and some are
            not; some hold a premillennial view of Christ&apos;s return, others
            postmillennial or amillennial. Faithful Christians have differed on
            questions like these for centuries — disagreement on them is
            normal, and it is no barrier to unity.
          </p>
          <p className="mt-3">
            What joins them is what matters most: who Jesus is, what He did on
            the cross, and that He rose again.
          </p>
          <p className="mt-3 font-medium italic text-neutral-800 dark:text-neutral-200">
            In essentials, unity. In non-essentials, liberty. In all things,
            charity.
          </p>
          <Link
            href="/start/what-christians-disagree-about"
            tabIndex={expanded ? 0 : -1}
            className="mt-3 inline-block font-medium text-amber-700 hover:underline dark:text-amber-400"
          >
            Where Christians disagree, and why that&apos;s alright →
          </Link>
        </div>
      </div>
    </section>
  );
}
