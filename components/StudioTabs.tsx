"use client";

// Channel-workspace tabs: always visible (sticky under the site header),
// amber active pill matching the Start Here pathway pattern. Each tab is a
// real route — switching tabs is navigation, so deep links and refresh work.
// A tab may carry children: when it (or a child) is the current route, a
// smaller sub-tab row renders beneath the main row (Settings → General /
// Analytics / Team / Payments).

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface StudioTab {
  slug: string;
  label: string;
  children?: StudioTab[];
}

export function StudioTabs({
  channelId,
  tabs,
}: {
  channelId: string;
  tabs: StudioTab[];
}) {
  const pathname = usePathname();
  const hrefFor = (slug: string) => `/studio/channel/${channelId}/${slug}`;
  const isOn = (slug: string) => {
    const href = hrefFor(slug);
    return pathname === href || pathname.startsWith(`${href}/`);
  };
  const tabActive = (tab: StudioTab) =>
    isOn(tab.slug) || (tab.children?.some((c) => isOn(c.slug)) ?? false);

  const openGroup = tabs.find((tab) => tab.children && tabActive(tab));

  return (
    <div className="sticky top-14 z-30 -mx-4 mt-6 border-b border-neutral-200 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
      <nav
        aria-label="Channel studio sections"
        className="flex gap-2 overflow-x-auto px-4 py-3"
      >
        {tabs.map((tab) => {
          const active = tabActive(tab);
          return (
            <Link
              key={tab.slug}
              href={hrefFor(tab.slug)}
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
      {openGroup?.children && (
        <nav
          aria-label={`${openGroup.label} sections`}
          className="flex gap-1 overflow-x-auto border-t border-neutral-100 px-4 py-2 dark:border-neutral-900"
        >
          {openGroup.children.map((sub) => {
            const active = isOn(sub.slug);
            return (
              <Link
                key={sub.slug}
                href={hrefFor(sub.slug)}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                }`}
              >
                {sub.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
