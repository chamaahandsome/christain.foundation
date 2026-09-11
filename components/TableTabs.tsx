"use client";

// The Table's rooms. Same amber pill as the studio workspace and the channel
// page — the audience side is a peer of the Studio, not a lesser surface.
// Each room is a real route, so deep links and refresh work.

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface TableRoom {
  slug: string; // "" = the hub
  label: string;
  count?: number;
}

export function TableTabs({ rooms }: { rooms: TableRoom[] }) {
  const pathname = usePathname();

  return (
    <div className="sticky top-14 z-30 -mx-4 border-b border-neutral-200 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
      <nav
        aria-label="Your table"
        className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {rooms.map((room) => {
          const href = room.slug ? `/table/${room.slug}` : "/table";
          const active = room.slug
            ? pathname === href || pathname.startsWith(`${href}/`)
            : pathname === "/table";
          return (
            <Link
              key={room.slug}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                  : "text-neutral-600 hover:bg-amber-50 hover:text-amber-900 dark:text-neutral-400 dark:hover:bg-amber-950/50 dark:hover:text-amber-300"
              }`}
            >
              {room.label}
              {room.count ? (
                <span
                  className={`ml-2 text-xs font-normal ${
                    active ? "text-amber-700 dark:text-amber-400" : "text-neutral-400"
                  }`}
                >
                  {room.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
