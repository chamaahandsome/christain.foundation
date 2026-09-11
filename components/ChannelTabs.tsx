"use client";

// Public channel tabs (/@handle, /@handle/videos, …) — amber pill for the
// active tab, same pattern as the studio workspace. Tabs appear only when
// the channel has that kind of content; Shop / Campaigns / Support join
// this list as those features land.
//
// On a phone the row is a selector rather than a rail: five or six pills
// could not fit, so they scrolled sideways, and the active one was as
// likely as not to sit off the right edge — the one pill that tells you
// where you are. So mobile shows the section you are in, and the rest on
// a tap.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface ChannelTab {
  slug: string; // "" = Home
  label: string;
}

export function ChannelTabs({
  handle,
  tabs,
}: {
  handle: string;
  tabs: ChannelTab[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const base = `/@${handle}`;

  const isActive = (slug: string) =>
    slug
      ? pathname === `${base}/${slug}` || pathname === `/channel/${handle}/${slug}`
      : pathname === base || pathname === `/channel/${handle}`;
  const hrefFor = (slug: string) => (slug ? `${base}/${slug}` : base);
  const onHome = isActive("");
  const current = tabs.find((t) => isActive(t.slug));

  // Close when the section changes, and on any tap outside the control.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (boxRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const pill = (active: boolean) =>
    active
      ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
      : "bg-neutral-100 text-neutral-700 hover:bg-amber-100 hover:text-amber-900 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-amber-950 dark:hover:text-amber-300";

  return (
    <>
      {!onHome && (
        <Link
          href={base}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-amber-700 hover:underline sm:hidden dark:text-amber-400"
        >
          <span aria-hidden>←</span> Back to @{handle}
        </Link>
      )}

      {/* Phone: the section you're in, and the rest on a tap. On Home the
          page's own stack is the navigation (Linktree-style), so nothing
          shows there — same as before. */}
      {!onHome && (
        <div
          ref={boxRef}
          className="relative mt-3 border-b border-neutral-200 pb-3 sm:hidden dark:border-neutral-800"
        >
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label="Change section"
            className={`flex w-full items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${pill(true)}`}
          >
            <span className="truncate">{current?.label ?? "Sections"}</span>
            <span aria-hidden className="shrink-0 text-[10px] opacity-70">
              {open ? "▲" : "▼"}
            </span>
          </button>

          {open && (
            <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-neutral-200 bg-white p-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-900">
              {tabs.map((tab) => {
                const active = isActive(tab.slug);
                return (
                  <Link
                    key={tab.slug}
                    href={hrefFor(tab.slug)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm ${
                      active
                        ? "bg-amber-50 font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                        : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <span className="w-4 shrink-0 text-amber-600">
                      {active ? "✓" : ""}
                    </span>
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Desktop: the full rail, where it fits. */}
      <nav
        aria-label="Channel sections"
        className="mt-6 hidden gap-2 overflow-x-auto border-b border-neutral-200 pb-3 scrollbar-none sm:flex dark:border-neutral-800 [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.slug}
            href={hrefFor(tab.slug)}
            aria-current={isActive(tab.slug) ? "page" : undefined}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors ${pill(
              isActive(tab.slug),
            )}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
