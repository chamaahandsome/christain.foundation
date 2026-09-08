"use client";

// Public booking form: a church or organizer requests the creator.

import { useState } from "react";
import { BookingCalendar } from "@/components/BookingCalendar";
import { TimeSlotPicker } from "@/components/TimeSlotPicker";
import { formatMin, slotHours } from "@/lib/availability";

interface PublicService {
  id: string;
  title: string;
  category: string;
  description: string;
  rateCents: number | null;
  rateUnit: string;
  requirements: string | null;
  availableDays: string[];
  durationMins: number | null;
  extras: { name: string; priceCents: number | null }[];
  images: string[];
  slotMinutes: number | null;
  timezone: string;
}

export function BookingForm({
  channelId,
  channelName,
  services,
}: {
  channelId: string;
  channelName: string;
  services: PublicService[];
}) {
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  // Time-slot services: pick days on the calendar, then times per day.
  const [pickedDays, setPickedDays] = useState<string[]>([]);
  const [dayIndex, setDayIndex] = useState(0);
  const [slotsByDay, setSlotsByDay] = useState<Record<string, number[]>>({});
  const chosen = services.find((s) => s.id === serviceId) ?? null;
  const needsSlot = Boolean(chosen?.slotMinutes);
  const sortedDays = [...pickedDays].sort();
  const currentDay = sortedDays[Math.min(dayIndex, sortedDays.length - 1)] ?? "";
  const totalSlots = Object.values(slotsByDay).reduce((n, l) => n + l.length, 0);
  const totalHours = slotHours(totalSlots, chosen?.slotMinutes ?? null);
  const daysMissingTimes = sortedDays.filter(
    (d) => (slotsByDay[d] ?? []).length === 0,
  );

  function toggleDay(ymd: string) {
    setPickedDays((prev) => {
      const has = prev.includes(ymd);
      const next = has ? prev.filter((d) => d !== ymd) : [...prev, ymd];
      if (has) {
        setSlotsByDay((s) => {
          const copy = { ...s };
          delete copy[ymd];
          return copy;
        });
      }
      setDayIndex(0);
      return next;
    });
  }
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const input =
    "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-amber-600";

  if (sent) {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm leading-6 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        📅 Your request is with {channelName}. You&apos;ll hear back by email
        and in your notifications — if they accept, the agreement arrives as a
        signing link.
      </div>
    );
  }

  const service = services.find((s) => s.id === serviceId) ?? null;

  return (
    <div className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
      {services.length > 0 && (
        <div className="mb-5 space-y-2">
          <p className="text-sm font-medium">What are you booking?</p>
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setServiceId(serviceId === s.id ? null : s.id);
                setSelectedExtras([]);
                setPickedDays([]);
                setSlotsByDay({});
                setDayIndex(0);
              }}
              className={`block w-full rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${
                serviceId === s.id
                  ? "border-amber-500 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/30"
                  : "border-neutral-200 hover:border-amber-300 dark:border-neutral-700"
              }`}
            >
              {s.images.length > 0 && (
                <div className="mb-2 flex gap-1.5 overflow-hidden">
                  {s.images.map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={url}
                      src={url}
                      alt=""
                      className="h-20 w-32 shrink-0 rounded-lg object-cover"
                    />
                  ))}
                </div>
              )}
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{s.title}</span>
                <span className="shrink-0 text-xs text-neutral-500">
                  {s.rateCents !== null
                    ? `$${(s.rateCents / 100).toLocaleString()}/${s.rateUnit}`
                    : "rate on request"}
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-5 text-neutral-500">
                {s.description}
                {s.durationMins ? ` · about ${s.durationMins} min` : ""}
                {s.availableDays.length > 0 &&
                  ` · usually available ${s.availableDays.join(", ")}`}
              </p>
              {serviceId === s.id && s.requirements && (
                <p className="mt-1 text-xs text-neutral-400">
                  Host provides: {s.requirements}
                </p>
              )}
              {/* Add-ons — tick what you'd like included */}
              {serviceId === s.id && s.extras.length > 0 && (
                <div
                  className="mt-2 space-y-1.5 border-t border-amber-200 pt-2 dark:border-amber-900"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                    Add-ons
                  </p>
                  {s.extras.map((x) => (
                    <label
                      key={x.name}
                      className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300"
                    >
                      <input
                        type="checkbox"
                        checked={selectedExtras.includes(x.name)}
                        onChange={(e) =>
                          setSelectedExtras((prev) =>
                            e.target.checked
                              ? [...prev, x.name]
                              : prev.filter((n) => n !== x.name),
                          )
                        }
                        className="h-3.5 w-3.5 accent-amber-600"
                      />
                      {x.name}
                      <span className="text-neutral-400">
                        {x.priceCents !== null
                          ? `+$${(x.priceCents / 100).toLocaleString()}`
                          : "price on request"}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
      {/* Time-slot services: pick days on the calendar, then times */}
      {needsSlot && chosen && (
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-sm font-medium">Pick your dates</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {chosen.slotMinutes}-minute slots · times in {chosen.timezone}
            </p>
            <div className="mt-2">
              <BookingCalendar
                serviceId={chosen.id}
                selected={pickedDays}
                onToggle={toggleDay}
              />
            </div>
          </div>

          {sortedDays.length > 0 && (
            <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-700">
              {/* Day carousel — one day's times at a time */}
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold">
                    {new Date(`${currentDay}T12:00:00Z`).toLocaleDateString(
                      undefined,
                      { weekday: "long", month: "long", day: "numeric" },
                    )}
                  </p>
                  {sortedDays.length > 1 && (
                    <p className="text-[11px] uppercase tracking-wider text-neutral-400">
                      Day {dayIndex + 1} of {sortedDays.length}
                    </p>
                  )}
                </div>
                {sortedDays.length > 1 && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => setDayIndex((i) => Math.max(0, i - 1))}
                      disabled={dayIndex === 0}
                      className="rounded-lg px-2.5 py-1 text-lg text-neutral-500 hover:bg-neutral-100 disabled:opacity-30 dark:hover:bg-neutral-800"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDayIndex((i) => Math.min(sortedDays.length - 1, i + 1))
                      }
                      disabled={dayIndex >= sortedDays.length - 1}
                      className="rounded-lg px-2.5 py-1 text-lg text-neutral-500 hover:bg-neutral-100 disabled:opacity-30 dark:hover:bg-neutral-800"
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>

              {/* Day dots — jump straight to a day; ✓ once it has times */}
              {sortedDays.length > 1 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {sortedDays.map((d, i) => {
                    const filled = (slotsByDay[d] ?? []).length > 0;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDayIndex(i)}
                        title={d}
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                          i === dayIndex
                            ? "bg-linear-to-br from-amber-500 to-orange-600 text-white"
                            : filled
                              ? "border border-green-300 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
                              : "border border-neutral-200 text-neutral-500 dark:border-neutral-700"
                        }`}
                      >
                        {filled ? "✓" : i + 1}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-3">
                {currentDay && (
                  <TimeSlotPicker
                    key={currentDay}
                    serviceId={chosen.id}
                    ymd={currentDay}
                    timezone={chosen.timezone}
                    selected={slotsByDay[currentDay] ?? []}
                    onChange={(mins) =>
                      setSlotsByDay((s) => ({ ...s, [currentDay]: mins }))
                    }
                  />
                )}
              </div>

              {/* Running total across every chosen day */}
              {totalSlots > 0 && (
                <div className="mt-4 space-y-1 border-t border-neutral-100 pt-3 text-xs dark:border-neutral-800">
                  {sortedDays.map((d) => {
                    const mins = [...(slotsByDay[d] ?? [])].sort((a, b) => a - b);
                    return (
                      <div key={d} className="flex justify-between">
                        <span className="text-neutral-500">
                          {new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <span className="font-medium">
                          {mins.length === 0 ? (
                            <span className="text-neutral-400">No times yet</span>
                          ) : (
                            `${formatMin(mins[0])} · ${slotHours(mins.length, chosen.slotMinutes)}h`
                          )}
                        </span>
                      </div>
                    );
                  })}
                  <div className="flex justify-between border-t border-neutral-100 pt-1.5 font-bold dark:border-neutral-800">
                    <span>Total</span>
                    <span className="text-amber-700 dark:text-amber-400">
                      {totalHours} {totalHours === 1 ? "hour" : "hours"}
                      {chosen.rateUnit === "hour" && chosen.rateCents !== null && (
                        <>
                          {" · $"}
                          {((totalHours * chosen.rateCents) / 100).toLocaleString()}
                        </>
                      )}
                    </span>
                  </div>
                </div>
              )}
              {daysMissingTimes.length > 0 && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                  Pick times for {daysMissingTimes.length} more day
                  {daysMissingTimes.length > 1 ? "s" : ""}.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={requesterName}
          onChange={(e) => setRequesterName(e.target.value)}
          placeholder="Your full name"
          className={input}
        />
        <input
          value={requesterEmail}
          onChange={(e) => setRequesterEmail(e.target.value)}
          type="email"
          placeholder="Your email"
          className={input}
        />
        <input
          value={organization}
          onChange={(e) => setOrganization(e.target.value)}
          placeholder="Church / organization (optional)"
          className={input}
        />
        {!needsSlot && (
          <div className="flex items-center gap-2 rounded-lg border border-neutral-300 px-3 dark:border-neutral-700">
            <span className="text-sm text-neutral-500">When</span>
            <input
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              type="date"
              className="w-full bg-transparent py-2 text-sm outline-none"
            />
          </div>
        )}
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Where (city, venue — optional)"
          className={input}
        />
        <div className="flex items-center gap-1 rounded-lg border border-neutral-300 px-3 dark:border-neutral-700">
          <span className="text-sm text-neutral-500">Budget $</span>
          <input
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            type="number"
            min={0}
            placeholder="optional"
            className="w-full bg-transparent py-2 text-sm outline-none"
          />
        </div>
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        maxLength={5000}
        placeholder={`What are you inviting ${channelName} to? The occasion, the audience, what you're hoping for.`}
        className={`${input} mt-3`}
      />

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        disabled={
          busy ||
          (needsSlot && (totalSlots === 0 || daysMissingTimes.length > 0))
        }
        title={
          needsSlot && totalSlots === 0
            ? "Pick a date and time first"
            : needsSlot && daysMissingTimes.length > 0
              ? "Every chosen day needs times"
              : undefined
        }
        onClick={() => {
          setBusy(true);
          setError(null);
          void fetch("/api/booking-request", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              channelId,
              ...(serviceId ? { serviceId } : {}),
              ...(selectedExtras.length > 0 ? { selectedExtras } : {}),
              ...(needsSlot && totalSlots > 0
                ? {
                    slots: sortedDays.flatMap((d) =>
                      (slotsByDay[d] ?? []).map((startMin) => ({
                        date: d,
                        startMin,
                      })),
                    ),
                  }
                : {}),
              requesterName,
              requesterEmail,
              ...(organization.trim() ? { organization } : {}),
              ...(eventDate
                ? { eventDate: new Date(`${eventDate}T12:00:00Z`).toISOString() }
                : {}),
              ...(location.trim() ? { location } : {}),
              ...(budget ? { budgetCents: Math.round(Number(budget) * 100) } : {}),
              message,
            }),
          })
            .then(async (res) => {
              const data = await res.json().catch(() => ({}));
              if (!res.ok) setError(data.error ?? `Failed (${res.status})`);
              else setSent(true);
            })
            .finally(() => setBusy(false));
        }}
        className="mt-4 rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500 disabled:opacity-50"
      >
        {busy ? "Sending…" : `📅 Request to book ${channelName}`}
      </button>
      <p className="mt-2 text-xs text-neutral-500">
        No account needed — {channelName} replies to the email you give.
      </p>
    </div>
  );
}
