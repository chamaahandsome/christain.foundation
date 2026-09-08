"use client";

// The public booking calendar (the Maltivas month grid, CF-skinned): a
// custom month built from plain date math — multi-select days, each
// coloured by status, with the legend beneath. Available and partially
// booked days are clickable; booked, unavailable and past days are not.

import { useEffect, useState } from "react";
import type { DayStatus } from "@/lib/availability";
import { DAY_CODES } from "@/lib/availability";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function BookingCalendar({
  serviceId,
  selected,
  onToggle,
}: {
  serviceId: string;
  /** "YYYY-MM-DD" values, in click order */
  selected: string[];
  onToggle: (ymd: string) => void;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(() => ({
    year: today.getUTCFullYear(),
    month: today.getUTCMonth(),
  }));
  const [days, setDays] = useState<Record<string, DayStatus>>({});
  const [loading, setLoading] = useState(false);

  // One request per month paints the whole grid.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const month = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}`;
    fetch(`/api/services/${serviceId}/availability?month=${month}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setDays(data.days ?? {});
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serviceId, cursor]);

  const first = new Date(Date.UTC(cursor.year, cursor.month, 1));
  const daysInMonth = new Date(Date.UTC(cursor.year, cursor.month + 1, 0)).getUTCDate();
  const leadingBlanks = first.getUTCDay();

  const shift = (delta: number) =>
    setCursor((c) => {
      const m = c.month + delta;
      return { year: c.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });

  const cellClass = (status: DayStatus, isSelected: boolean) => {
    if (isSelected) {
      return "bg-linear-to-br from-amber-500 to-orange-600 font-semibold text-white shadow-md shadow-amber-500/30";
    }
    switch (status) {
      case "available":
        return "border border-green-300 bg-green-50 text-green-800 hover:bg-green-100 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300";
      case "partial":
        return "border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
      case "booked":
        return "cursor-not-allowed border border-red-200 bg-red-50 text-red-400 dark:border-red-900 dark:bg-red-950/30";
      default:
        return "cursor-not-allowed text-neutral-300 dark:text-neutral-700";
    }
  };

  const legend: { label: string; className: string }[] = [
    { label: "Available", className: "border-green-300 bg-green-50 dark:bg-green-950/40" },
    { label: "Selected", className: "border-amber-500 bg-linear-to-br from-amber-500 to-orange-600" },
    { label: "Some times left", className: "border-amber-300 bg-amber-50 dark:bg-amber-950/40" },
    { label: "Booked", className: "border-red-200 bg-red-50 dark:bg-red-950/30" },
  ];

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label="Previous month"
          className="rounded-lg px-2.5 py-1 text-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          ‹
        </button>
        <p className="text-sm font-bold">
          {MONTHS[cursor.month]} {cursor.year}
          {loading && <span className="ml-2 text-xs font-normal text-neutral-400">…</span>}
        </p>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label="Next month"
          className="rounded-lg px-2.5 py-1 text-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          ›
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wider text-neutral-400">
        {DAY_CODES.map((d) => (
          <span key={d}>
            <span className="sm:hidden">{d[0]}</span>
            <span className="hidden sm:inline">{d}</span>
          </span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const ymd = new Date(Date.UTC(cursor.year, cursor.month, day))
            .toISOString()
            .slice(0, 10);
          const status = days[ymd] ?? "unavailable";
          const isSelected = selected.includes(ymd);
          const clickable = status === "available" || status === "partial";
          return (
            <button
              key={ymd}
              type="button"
              disabled={!clickable && !isSelected}
              onClick={() => onToggle(ymd)}
              title={
                status === "booked"
                  ? "Fully booked"
                  : status === "partial"
                    ? "Some times still open"
                    : undefined
              }
              className={`relative aspect-square rounded-lg text-sm transition-all ${cellClass(status, isSelected)}`}
            >
              {day}
              {isSelected && (
                <span className="absolute right-0.5 top-0.5 text-[10px]">✓</span>
              )}
              {!isSelected && status === "partial" && (
                <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-amber-500" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-neutral-100 pt-3 text-[11px] text-neutral-500 dark:border-neutral-800">
        {legend.map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded border ${l.className}`} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
