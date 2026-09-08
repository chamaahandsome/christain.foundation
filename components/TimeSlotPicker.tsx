"use client";

// The time picker for one selected day (the Maltivas TimeSlotPicker,
// CF-skinned): a slot grid where each cell shows start over end, taken
// slots are struck out, and selections must form a consecutive run
// within the day's min/max. A summary strip shows the resulting range
// and total.

import { useEffect, useState } from "react";
import { formatMin, slotHours, slotsAreConsecutive } from "@/lib/availability";

interface ApiSlot {
  startMin: number;
  endMin: number;
  label: string;
  taken: boolean;
}

export function TimeSlotPicker({
  serviceId,
  ymd,
  timezone,
  selected,
  onChange,
}: {
  serviceId: string;
  /** the day being picked, "YYYY-MM-DD" */
  ymd: string;
  timezone: string;
  /** chosen startMin values for this day */
  selected: number[];
  onChange: (startMins: number[]) => void;
}) {
  const [slots, setSlots] = useState<ApiSlot[]>([]);
  const [minSlots, setMinSlots] = useState(1);
  const [maxSlots, setMaxSlots] = useState<number | null>(null);
  const [slotMinutes, setSlotMinutes] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/services/${serviceId}/availability?date=${ymd}`)
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) {
          setNote(data.error ?? "Couldn't load times.");
          setSlots([]);
          return;
        }
        setMinSlots(data.minBookingSlots ?? 1);
        setMaxSlots(data.maxBookingSlots ?? null);
        setSlotMinutes(data.slotMinutes ?? null);
        if (!data.open) {
          setNote(
            data.reason === "not-available-day"
              ? "Not available that day."
              : data.reason === "too-soon"
                ? "Too soon to book that day."
                : data.reason === "too-far"
                  ? "Further ahead than they book."
                  : "No times that day.",
          );
          setSlots([]);
          return;
        }
        setNote(null);
        setSlots(data.slots ?? []);
      })
      .catch(() => {
        if (!cancelled) setNote("Couldn't load times.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [serviceId, ymd]);

  const config = {
    slotMinutes,
    dailyStart: slots.length ? formatHhMm(slots[0].startMin) : null,
    dailyEnd: slots.length ? formatHhMm(slots.at(-1)!.endMin) : null,
    bufferMins: 0,
  };

  function toggle(startMin: number) {
    setError(null);
    const has = selected.includes(startMin);
    const next = has
      ? selected.filter((m) => m !== startMin)
      : [...selected, startMin];

    if (next.length === 0) {
      onChange(next);
      return;
    }
    if (!slotsAreConsecutive(next, config)) {
      setError("Pick consecutive times — they run back to back.");
      return;
    }
    if (maxSlots && next.length > maxSlots) {
      setError(`At most ${slotHours(maxSlots, slotMinutes)} hours a day.`);
      return;
    }
    onChange(next.sort((a, b) => a - b));
  }

  const sorted = [...selected].sort((a, b) => a - b);
  const chosenSlots = sorted
    .map((m) => slots.find((s) => s.startMin === m))
    .filter((s): s is ApiSlot => Boolean(s));
  const hours = slotHours(selected.length, slotMinutes);

  if (loading) {
    return (
      <p className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
        Loading times…
      </p>
    );
  }
  if (note) {
    return (
      <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        {note}
      </p>
    );
  }

  return (
    <div>
      <p className="text-xs text-neutral-500">
        Choose {minSlots > 1 ? `at least ${minSlots} consecutive slots` : "a time"}
        {maxSlots ? ` (up to ${maxSlots})` : ""} · times shown in {timezone}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {slots.map((s) => {
          const isSelected = selected.includes(s.startMin);
          return (
            <button
              key={s.startMin}
              type="button"
              disabled={s.taken}
              onClick={() => toggle(s.startMin)}
              className={`relative flex flex-col items-center rounded-xl border px-2 py-2.5 transition-all ${
                isSelected
                  ? "border-amber-500 bg-linear-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25"
                  : s.taken
                    ? "cursor-not-allowed border-neutral-200 bg-neutral-50 text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900"
                    : "border-neutral-300 hover:border-amber-500 hover:bg-amber-50 dark:border-neutral-700 dark:hover:bg-amber-950/30"
              }`}
            >
              <span className="text-[13px] font-bold tracking-tight">
                {formatMin(s.startMin)}
              </span>
              {s.taken ? (
                <span className="text-[9px] font-bold uppercase tracking-wider">
                  Taken
                </span>
              ) : (
                <>
                  <span className="my-0.5 h-px w-4 bg-current opacity-25" />
                  <span className="text-[10px] font-medium opacity-70">
                    {formatMin(s.endMin)}
                  </span>
                </>
              )}
              {isSelected && (
                <span className="absolute right-1.5 top-1.5 text-[10px]">✓</span>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {chosenSlots.length > 0 && (
        <div className="mt-3 flex items-end justify-between rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">
              This day
            </p>
            <p className="text-sm font-bold">
              {formatMin(chosenSlots[0].startMin)} –{" "}
              {formatMin(chosenSlots.at(-1)!.endMin)}
            </p>
          </div>
          <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
            {hours} {hours === 1 ? "hour" : "hours"}
          </p>
        </div>
      )}
    </div>
  );
}

function formatHhMm(total: number): string {
  return `${Math.floor(total / 60)
    .toString()
    .padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
}
