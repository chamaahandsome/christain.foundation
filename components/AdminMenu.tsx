"use client";

// Header admin dropdown — every admin surface one click away, with a word
// on what each one is for.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const LINKS = [
  { href: "/admin/users", label: "Users", hint: "Who's here, what they make, what they earn" },
  { href: "/admin/applications", label: "Applications", hint: "Creator gate — review & approve" },
  { href: "/admin/curation", label: "Curation", hint: "Place teaching on the map's questions" },
  { href: "/admin/shelves", label: "Shelves", hint: "Curated rows on explore surfaces" },
  { href: "/admin/doctrine", label: "Doctrine queue", hint: "§5.4 reports on published teaching" },
  { href: "/admin/moderation", label: "Moderation", hint: "Comment reports — safety, not doctrine" },
  { href: "/admin/invites", label: "Invites", hint: "Founding-cohort invite codes" },
];

export function AdminMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1 rounded-lg px-3 py-1.5 font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
      >
        Admin
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 hover:bg-amber-50 dark:hover:bg-amber-950/40"
            >
              <span className="block text-sm font-medium">{link.label}</span>
              <span className="block text-xs text-neutral-500">{link.hint}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
