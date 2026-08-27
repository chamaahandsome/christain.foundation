"use client";

// Header nav link with active-route highlighting (amber pill, matching the
// studio tabs). Active = exact match or a child route.

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-lg px-3 py-1.5 transition-colors ${
        active
          ? "bg-amber-100 font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-300"
          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
      }`}
    >
      {children}
    </Link>
  );
}
