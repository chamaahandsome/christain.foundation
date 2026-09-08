"use client";

// Booking one online 1:1 — pick a day, pick a time, say who you are, done.
//
// Deliberately shorter than the hire flow next door: there is nothing to
// negotiate. A free session confirms on the spot and hands over the meeting
// link; a paid one goes to Stripe and confirms when the charge lands.

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookingCalendar } from "@/components/BookingCalendar";
import { TimeSlotPicker } from "@/components/TimeSlotPicker";
import { formatMin } from "@/lib/availability";

export interface SessionView {
  id: string;
  title: string;
  category: string;
  description: string;
  rateCents: number | null;
  slotMinutes: number | null;
  timezone: string;
  images: string[];
  availableDays: string[];
  meetingProvider: string;
}

export function SessionBookingClient({
  channelId,
  channelName,
  handle,
  session,
}: {
  channelId: string;
  channelName: string;
  handle: string;
  session: SessionView;
}) {
  const searchParams = useSearchParams();
  // Coming back from Stripe: the webhook confirms the booking, so this is
  // only the receipt the payer sees.
  const paidReturn = Boolean(searchParams?.get("booked"));
  const cancelledReturn = Boolean(searchParams?.get("cancelled"));

  const [day, setDay] = useState<string | null>(null);
  const [startMins, setStartMins] = useState<number[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ meetingUrl: string | null } | null>(null);

  const free = !session.rateCents || session.rateCents <= 0;
  const startMin = startMins[0] ?? null;
  const ready =
    day !== null && startMin !== null && name.trim().length >= 2 && email.includes("@");

  const input =
    "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-amber-600";

  if (paidReturn || done) {
    return (
      <div className="rounded-2xl border border-green-300 bg-green-50 p-6 dark:border-green-800 dark:bg-green-950/40">
        <p className="text-3xl">✅</p>
        <h2 className="mt-2 text-lg font-bold text-green-900 dark:text-green-200">
          You&apos;re booked with {channelName}
        </h2>
        <p className="mt-1 text-sm leading-6 text-green-900/80 dark:text-green-200/80">
          A confirmation with the meeting link and a calendar invite is on its
          way to your inbox.
        </p>
        {done?.meetingUrl && (
          <a
            href={done.meetingUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500"
          >
            Join the meeting
          </a>
        )}
        <p className="mt-4 text-xs">
          <Link href={`/@${handle}/book`} className="underline">
            Book another time
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        {cancelledReturn && (
          <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            Payment was cancelled, so nothing was booked. Pick a time to try
            again.
          </p>
        )}

        {/* 1 — the day */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">
            1 · Pick a day
          </h2>
          <div className="mt-3">
            <BookingCalendar
              serviceId={session.id}
              selected={day ? [day] : []}
              onToggle={(ymd) => {
                setDay((prev) => (prev === ymd ? null : ymd));
                setStartMins([]);
              }}
            />
          </div>
        </section>

        {/* 2 — the time */}
        {day && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">
              2 · Pick a time
            </h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              {new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                timeZone: "UTC",
              })}{" "}
              · times in {session.timezone}
            </p>
            <div className="mt-3">
              <TimeSlotPicker
                key={day}
                serviceId={session.id}
                ymd={day}
                timezone={session.timezone}
                selected={startMins}
                onChange={(mins) => setStartMins(mins.slice(-1))}
              />
            </div>
          </section>
        )}

        {/* 3 — who you are */}
        {startMin !== null && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-500">
              3 · Your details
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className={input}
              />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="Your email"
                className={input}
              />
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={5000}
              placeholder={`What would you like to talk about with ${channelName}? (optional)`}
              className={`${input} mt-3`}
            />
          </section>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      {/* The summary rail — what you're booking, and the button */}
      <aside className="h-fit space-y-4 rounded-2xl border border-neutral-200 p-5 lg:sticky lg:top-24 dark:border-neutral-800">
        {session.images[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.images[0]}
            alt=""
            className="h-28 w-full rounded-xl object-cover"
          />
        )}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
            {session.category}
          </p>
          <h3 className="mt-0.5 font-bold leading-tight">{session.title}</h3>
          <p className="mt-1 text-xs text-neutral-500">with {channelName}</p>
        </div>

        <dl className="space-y-1.5 border-t border-neutral-100 pt-3 text-xs dark:border-neutral-800">
          <div className="flex justify-between gap-3">
            <dt className="text-neutral-500">Length</dt>
            <dd className="font-medium">{session.slotMinutes} minutes</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-neutral-500">When</dt>
            <dd className="text-right font-medium">
              {day && startMin !== null ? (
                <>
                  {new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  })}
                  <br />
                  {formatMin(startMin)} ({session.timezone})
                </>
              ) : (
                <span className="text-neutral-400">Not picked yet</span>
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-neutral-500">Where</dt>
            <dd className="font-medium">
              {session.meetingProvider === "custom" ? "Online" : "Google Meet"}
            </dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-neutral-100 pt-1.5 text-sm font-bold dark:border-neutral-800">
            <dt>Total</dt>
            <dd className="text-amber-700 dark:text-amber-400">
              {free ? "Free" : `$${((session.rateCents ?? 0) / 100).toLocaleString()}`}
            </dd>
          </div>
        </dl>

        <button
          disabled={busy || !ready}
          title={!ready ? "Pick a time and fill in your details" : undefined}
          onClick={() => {
            if (!day || startMin === null) return;
            setBusy(true);
            setError(null);
            void fetch("/api/booking-request", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                channelId,
                serviceId: session.id,
                requesterName: name,
                requesterEmail: email,
                message: note,
                slots: [{ date: day, startMin }],
              }),
            })
              .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                  setError(data.error ?? `Failed (${res.status})`);
                  return;
                }
                if (data.checkoutUrl) {
                  window.location.href = data.checkoutUrl as string;
                  return;
                }
                setDone({ meetingUrl: (data.meetingUrl as string | null) ?? null });
              })
              .catch(() => setError("Something went wrong. Try again."))
              .finally(() => setBusy(false));
          }}
          className="w-full rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500 disabled:opacity-50"
        >
          {busy
            ? free
              ? "Booking…"
              : "Taking you to checkout…"
            : free
              ? "Book this session"
              : `Pay $${((session.rateCents ?? 0) / 100).toLocaleString()} & book`}
        </button>
        <p className="text-[11px] leading-5 text-neutral-400">
          {free
            ? "You'll get a calendar invite and the meeting link by email straight away."
            : "Your slot is held for 30 minutes while you pay. The calendar invite and meeting link follow by email."}
        </p>
      </aside>
    </div>
  );
}
