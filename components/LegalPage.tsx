// The frame both legal pages share: a plain, readable column on CF's
// neutral ground, with the amber eyebrow the rest of the site uses. Kept
// deliberately quiet — these pages are read closely, sometimes by Google's
// reviewers, and nothing here should get in the way of the words.

import Link from "next/link";

export function LegalPage({
  eyebrow,
  title,
  updated,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  /** the effective date, spelled out */
  updated: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
        {eyebrow}
      </p>
      <h1 className="mt-2 text-4xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-sm text-neutral-500">Last updated: {updated}</p>
      {intro && (
        <div className="mt-6 text-[15px] leading-7 text-neutral-700 dark:text-neutral-300">
          {intro}
        </div>
      )}
      <div className="mt-10 space-y-10">{children}</div>
      <div className="mt-14 border-t border-neutral-200 pt-6 text-sm text-neutral-500 dark:border-neutral-800">
        <Link
          href="/"
          className="hover:text-amber-700 dark:hover:text-amber-400"
        >
          ← Back to Christian Foundation
        </Link>
      </div>
    </main>
  );
}

/** One numbered section. */
export function Section({
  n,
  heading,
  children,
}: {
  n: number;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section id={`s${n}`} className="scroll-mt-24">
      <h2 className="text-xl font-semibold tracking-tight">
        <span className="mr-2 text-neutral-400">{n}.</span>
        {heading}
      </h2>
      <div className="mt-3 space-y-4 text-[15px] leading-7 text-neutral-700 dark:text-neutral-300">
        {children}
      </div>
    </section>
  );
}

/** A sub-heading inside a section. */
export function Sub({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="pt-2 text-base font-semibold text-neutral-900 dark:text-neutral-100">
      {children}
    </h3>
  );
}

/** A bulleted list, the only list style either page needs. */
export function List({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc space-y-2 pl-6 marker:text-amber-500">
      {children}
    </ul>
  );
}

/** Bold run-in label at the head of a list item. */
export function Term({ children }: { children: React.ReactNode }) {
  return (
    <strong className="font-semibold text-neutral-900 dark:text-neutral-100">
      {children}
    </strong>
  );
}
