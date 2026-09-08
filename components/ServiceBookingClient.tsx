"use client";

// One service's booking page (the Maltivas BookingClient, CF-skinned):
// steps down the left — Select a date, Select time slots, Your details —
// with the booking summary standing beside them the whole way. Services
// that don't run on slots skip straight to the details step and name their
// own date there.

import { useState } from "react";
import Link from "next/link";
import { BookingCalendar } from "@/components/BookingCalendar";
import { TimeSlotPicker } from "@/components/TimeSlotPicker";
import { formatMin, slotHours } from "@/lib/availability";

export interface BookableServiceView {
  id: string;
  title: string;
  category: string;
  description: string;
  rateCents: number | null;
  rateUnit: string;
  privateRate: boolean;
  requirements: string | null;
  availableDays: string[];
  durationMins: number | null;
  extras: { name: string; priceCents: number | null }[];
  images: string[];
  slotMinutes: number | null;
  timezone: string;
  minBookingSlots: number | null;
  maxBookingSlots: number | null;
}

export function ServiceBookingClient({
  channelId,
  channelName,
  handle,
  service,
}: {
  channelId: string;
  channelName: string;
  handle: string;
  service: BookableServiceView;
}) {
  const usesSlots = Boolean(service.slotMinutes);
  // Slot services walk dates → times → details; others go straight to details.
  const [step, setStep] = useState<1 | 2 | 3 | 4>(usesSlots ? 1 : 3);

  const [pickedDays, setPickedDays] = useState<string[]>([]);
  const [dayIndex, setDayIndex] = useState(0);
  const [slotsByDay, setSlotsByDay] = useState<Record<string, number[]>>({});
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);

  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [organization, setOrganization] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [budget, setBudget] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedDays = [...pickedDays].sort();
  const currentDay = sortedDays[Math.min(dayIndex, sortedDays.length - 1)] ?? "";
  const totalSlots = Object.values(slotsByDay).reduce((n, l) => n + l.length, 0);
  const totalHours = slotHours(totalSlots, service.slotMinutes);
  const daysMissingTimes = sortedDays.filter(
    (d) => (slotsByDay[d] ?? []).length === 0,
  );

  const extrasTotal = service.extras
    .filter((x) => selectedExtras.includes(x.name))
    .reduce((n, x) => n + (x.priceCents ?? 0), 0);
  const timeTotal =
    service.rateCents !== null && service.rateUnit === "hour"
      ? totalHours * service.rateCents
      : service.rateCents !== null && usesSlots
        ? service.rateCents * totalSlots
        : (service.rateCents ?? 0);
  const grandTotal = timeTotal + extrasTotal;

  const input =
    "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-amber-600";

  function toggleDay(ymd: string) {
    setPickedDays((prev) => {
      const has = prev.includes(ymd);
      if (has) {
        setSlotsByDay((s) => {
          const copy = { ...s };
          delete copy[ymd];
          return copy;
        });
      }
      setDayIndex(0);
      return has ? prev.filter((d) => d !== ymd) : [...prev, ymd];
    });
  }

  function submit() {
    setBusy(true);
    setError(null);
    void fetch("/api/booking-request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        channelId,
        serviceId: service.id,
        ...(selectedExtras.length > 0 ? { selectedExtras } : {}),
        ...(usesSlots && totalSlots > 0
          ? {
              slots: sortedDays.flatMap((d) =>
                (slotsByDay[d] ?? []).map((startMin) => ({ date: d, startMin })),
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
        else setStep(4);
      })
      .finally(() => setBusy(false));
  }

  if (step === 4) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-amber-500 to-orange-600 text-3xl text-white shadow-lg shadow-amber-500/25">
          ✓
        </div>
        <h2 className="mt-5 text-2xl font-extrabold">Request sent</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
          Your request for <strong>{service.title}</strong> is with{" "}
          {channelName}. You&apos;ll hear back by email — if they accept, the
          agreement arrives as a signing link.
          {usesSlots && totalSlots > 0 && (
            <>
              {" "}
              Your times are held for you in the meantime.
            </>
          )}
        </p>
        <Link
          href={`/@${handle}/book`}
          className="mt-6 inline-block rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-medium hover:border-amber-500 dark:border-neutral-700"
        >
          Back to services
        </Link>
      </div>
    );
  }

  const steps = usesSlots
    ? [
        { n: 1, label: "Date" },
        { n: 2, label: "Times" },
        { n: 3, label: "Details" },
      ]
    : [{ n: 3, label: "Details" }];

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2">
        {/* Step rail */}
        {usesSlots && (
          <div className="mb-6 flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={s.n} className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={s.n > step}
                  onClick={() => setStep(s.n as 1 | 2 | 3)}
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                    s.n === step
                      ? "bg-linear-to-r from-amber-500 to-orange-600 text-white"
                      : s.n < step
                        ? "border border-green-300 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300"
                        : "border border-neutral-200 text-neutral-400 dark:border-neutral-700"
                  }`}
                >
                  <span>{s.n < step ? "✓" : i + 1}</span>
                  {s.label}
                </button>
                {i < steps.length - 1 && (
                  <span className="h-px w-4 bg-neutral-200 dark:bg-neutral-700" />
                )}
              </div>
            ))}
          </div>
        )}

        {step === 1 && (
          <section>
            <h2 className="text-xl font-extrabold">Select a date</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Pick one day or several — you&apos;ll choose times for each next.
              Times are in {service.timezone}.
            </p>
            <div className="mt-4">
              <BookingCalendar
                serviceId={service.id}
                selected={pickedDays}
                onToggle={toggleDay}
              />
            </div>
            {sortedDays.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {sortedDays.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                  >
                    {longDate(d)}
                    <span className="opacity-50">✕</span>
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              disabled={sortedDays.length === 0}
              onClick={() => setStep(2)}
              className="mt-5 rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500 disabled:opacity-50"
            >
              Continue to times →
            </button>
          </section>
        )}

        {step === 2 && (
          <section>
            <h2 className="text-xl font-extrabold">Select time slots</h2>
            <p className="mt-1 text-sm text-neutral-500">
              {service.slotMinutes}-minute slots, back to back.
              {service.minBookingSlots && service.minBookingSlots > 1
                ? ` At least ${service.minBookingSlots} a day.`
                : ""}
            </p>

            <div className="mt-4 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-700">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold">{longDate(currentDay)}</p>
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

              <div className="mt-4">
                {currentDay && (
                  <TimeSlotPicker
                    key={currentDay}
                    serviceId={service.id}
                    ymd={currentDay}
                    timezone={service.timezone}
                    selected={slotsByDay[currentDay] ?? []}
                    onChange={(mins) =>
                      setSlotsByDay((s) => ({ ...s, [currentDay]: mins }))
                    }
                  />
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                {dayIndex < sortedDays.length - 1 && (
                  <button
                    type="button"
                    onClick={() => setDayIndex((i) => i + 1)}
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:border-amber-500 dark:border-neutral-700"
                  >
                    Save &amp; next day →
                  </button>
                )}
                {(slotsByDay[currentDay] ?? []).length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setSlotsByDay((s) => ({ ...s, [currentDay]: [] }))
                    }
                    className="rounded-lg px-3 py-1.5 text-xs text-neutral-500 hover:text-red-600 dark:hover:text-red-400"
                  >
                    Clear this day
                  </button>
                )}
              </div>
            </div>

            {daysMissingTimes.length > 0 && (
              <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
                Pick times for {daysMissingTimes.length} more day
                {daysMissingTimes.length > 1 ? "s" : ""}.
              </p>
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-xl border border-neutral-300 px-5 py-3 text-sm font-medium hover:border-amber-500 dark:border-neutral-700"
              >
                ← Back to dates
              </button>
              <button
                type="button"
                disabled={totalSlots === 0 || daysMissingTimes.length > 0}
                onClick={() => setStep(3)}
                className="rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500 disabled:opacity-50"
              >
                Continue to details →
              </button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section>
            <h2 className="text-xl font-extrabold">Your details</h2>
            <p className="mt-1 text-sm text-neutral-500">
              So {channelName} knows who&apos;s asking and what for.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
              {!usesSlots && (
                <div className="flex items-center gap-2 rounded-lg border border-neutral-300 px-3 dark:border-neutral-700">
                  <span className="shrink-0 text-sm text-neutral-500">When</span>
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
                <span className="shrink-0 text-sm text-neutral-500">Budget $</span>
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

            {service.extras.length > 0 && (
              <div className="mt-5 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-700">
                <p className="text-sm font-bold">What extras will you need?</p>
                <div className="mt-2 space-y-2">
                  {service.extras.map((x) => (
                    <label
                      key={x.name}
                      className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300"
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
                        className="h-4 w-4 accent-amber-600"
                      />
                      {x.name}
                      <span className="ml-auto text-xs text-neutral-400">
                        {x.priceCents !== null
                          ? `+$${(x.priceCents / 100).toLocaleString()}`
                          : "price on request"}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={5000}
              placeholder={`What are you inviting ${channelName} to? The occasion, the audience, what you're hoping for.`}
              className={`${input} mt-4`}
            />

            {error && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            <div className="mt-5 flex gap-2">
              {usesSlots && (
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="rounded-xl border border-neutral-300 px-5 py-3 text-sm font-medium hover:border-amber-500 dark:border-neutral-700"
                >
                  ← Back
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={submit}
                className="rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500 disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send request"}
              </button>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              No account needed — {channelName} replies to the email you give.
            </p>
          </section>
        )}
      </div>

      {/* Booking summary — stands beside every step */}
      <aside className="lg:col-span-1">
        <div className="sticky top-24 overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
          {service.images[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={service.images[0]}
              alt=""
              className="h-28 w-full object-cover"
            />
          )}
          <div className="space-y-4 p-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                Booking summary
              </p>
              <h3 className="mt-1 font-bold leading-tight">{service.title}</h3>
              <p className="text-xs text-neutral-500">
                with {channelName}
                {usesSlots ? ` · ${service.timezone}` : ""}
              </p>
            </div>

            {usesSlots && (
              <div className="space-y-1.5 border-t border-neutral-100 pt-3 text-xs dark:border-neutral-800">
                {sortedDays.length === 0 && (
                  <p className="text-neutral-400">No dates chosen yet.</p>
                )}
                {sortedDays.map((d) => {
                  const mins = [...(slotsByDay[d] ?? [])].sort((a, b) => a - b);
                  return (
                    <div key={d} className="flex justify-between gap-2">
                      <span className="text-neutral-500">{shortDate(d)}</span>
                      <span className="text-right font-medium">
                        {mins.length === 0 ? (
                          <span className="text-neutral-400">No times yet</span>
                        ) : (
                          `${formatMin(mins[0])} · ${slotHours(mins.length, service.slotMinutes)}h`
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {selectedExtras.length > 0 && (
              <div className="space-y-1 border-t border-neutral-100 pt-3 text-xs dark:border-neutral-800">
                {service.extras
                  .filter((x) => selectedExtras.includes(x.name))
                  .map((x) => (
                    <div key={x.name} className="flex justify-between gap-2">
                      <span className="text-neutral-500">{x.name}</span>
                      <span className="font-medium">
                        {x.priceCents !== null
                          ? `+$${(x.priceCents / 100).toLocaleString()}`
                          : "TBD"}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            <div className="border-t border-neutral-100 pt-3 dark:border-neutral-800">
              {service.rateCents === null || service.privateRate ? (
                <p className="text-sm font-bold text-neutral-500">
                  Price on request
                </p>
              ) : (
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                    {usesSlots && totalSlots === 0 ? "From" : "Total"}
                  </span>
                  <span className="text-lg font-extrabold text-amber-700 dark:text-amber-400">
                    $
                    {(
                      (usesSlots && totalSlots === 0
                        ? service.rateCents
                        : grandTotal) / 100
                    ).toLocaleString()}
                  </span>
                </div>
              )}
              <p className="mt-1 text-[11px] leading-4 text-neutral-500">
                Nothing is charged now — {channelName} confirms first, and the
                agreement is signed here.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function longDate(ymd: string): string {
  if (!ymd) return "";
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function shortDate(ymd: string): string {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
