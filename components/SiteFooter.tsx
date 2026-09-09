// The site footer. Quiet by design — its real job is to carry the legal
// links, which Google's API review expects to find from the home page.

import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-balance">
          <span className="font-semibold text-neutral-700 dark:text-neutral-300">
            Christian Foundation
          </span>{" "}
          — in essentials, unity. In non-essentials, liberty. In all things,
          charity.
        </p>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/start" className="hover:text-amber-700 dark:hover:text-amber-400">
            Start here
          </Link>
          <Link href="/apply" className="hover:text-amber-700 dark:hover:text-amber-400">
            Apply
          </Link>
          <Link href="/privacy" className="hover:text-amber-700 dark:hover:text-amber-400">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-amber-700 dark:hover:text-amber-400">
            Terms
          </Link>
          <a
            href="mailto:support@thecf.online"
            className="hover:text-amber-700 dark:hover:text-amber-400"
          >
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
