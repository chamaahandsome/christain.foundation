"use client";

// Public booking form: a church or organizer requests the creator.

import { useState } from "react";

interface PublicService {
  id: string;
  title: string;
  category: string;
  description: string;
  rateCents: number | null;
  rateUnit: string;
  requirements: string | null;
  availableDays: string[];
}

export function BookingForm({
  channelId,
  channelName,
  signedIn,
  services,
}: {
  channelId: string;
  channelName: string;
  signedIn: boolean;
  services: PublicService[];
}) {
  const [serviceId, setServiceId] = useState<string | null>(null);
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
              onClick={() => setServiceId(serviceId === s.id ? null : s.id)}
              className={`block w-full rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${
                serviceId === s.id
                  ? "border-amber-500 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/30"
                  : "border-neutral-200 hover:border-amber-300 dark:border-neutral-700"
              }`}
            >
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
                {s.availableDays.length > 0 &&
                  ` · usually available ${s.availableDays.join(", ")}`}
              </p>
              {serviceId === s.id && s.requirements && (
                <p className="mt-1 text-xs text-neutral-400">
                  Host provides: {s.requirements}
                </p>
              )}
            </button>
          ))}
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
        <div className="flex items-center gap-2 rounded-lg border border-neutral-300 px-3 dark:border-neutral-700">
          <span className="text-sm text-neutral-500">When</span>
          <input
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            type="date"
            className="w-full bg-transparent py-2 text-sm outline-none"
          />
        </div>
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
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError(null);
          void fetch("/api/booking-request", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              channelId,
              ...(serviceId ? { serviceId } : {}),
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
              if (res.status === 401) setError("Sign in to send a booking request.");
              else if (!res.ok) setError(data.error ?? `Failed (${res.status})`);
              else setSent(true);
            })
            .finally(() => setBusy(false));
        }}
        className="mt-4 rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500 disabled:opacity-50"
      >
        {busy ? "Sending…" : `📅 Request to book ${channelName}`}
      </button>
      {!signedIn && (
        <p className="mt-2 text-xs text-neutral-500">Sign in to send a request.</p>
      )}
    </div>
  );
}
