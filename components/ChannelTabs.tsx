"use client";

// Public channel tabs (/@handle, /@handle/videos, …) — amber pill for the
// active tab, same pattern as the studio workspace. Tabs appear only when
// the channel has that kind of content; Shop / Campaigns / Support join
// this list as those features land.

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
  const base = `/@${handle}`;

  return (
    <nav
      aria-label="Channel sections"
      className="mt-6 flex gap-2 overflow-x-auto border-b border-neutral-200 pb-3 [scrollbar-width:none] dark:border-neutral-800 [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => {
        const href = tab.slug ? `${base}/${tab.slug}` : base;
        const active = tab.slug
          ? pathname === href || pathname === `/channel/${handle}/${tab.slug}`
          : pathname === base || pathname === `/channel/${handle}`;
        return (
          <Link
            key={tab.slug}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                : "bg-neutral-100 text-neutral-700 hover:bg-amber-100 hover:text-amber-900 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-amber-950 dark:hover:text-amber-300"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
