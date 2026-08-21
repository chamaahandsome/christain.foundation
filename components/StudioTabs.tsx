"use client";

// Channel-workspace tabs: always visible (sticky under the site header),
// amber active pill matching the Start Here pathway pattern. Each tab is a
// real route — switching tabs is navigation, so deep links and refresh work.

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface StudioTab {
  slug: string;
  label: string;
}

export function StudioTabs({
  channelId,
  tabs,
}: {
  channelId: string;
  tabs: StudioTab[];
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Channel studio sections"
      className="sticky top-14 z-30 -mx-4 mt-6 flex gap-2 overflow-x-auto border-b border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90"
    >
      {tabs.map((tab) => {
        const href = `/studio/channel/${channelId}/${tab.slug}`;
        const active = pathname === href || pathname.startsWith(`${href}/`);
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
