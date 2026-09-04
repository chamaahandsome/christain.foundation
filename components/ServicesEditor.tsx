"use client";

// Do-Biz bookable services editor: what can be booked, rates, available
// days, and visibility on the public book page.

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface Service {
  id: string;
  title: string;
  category: string;
  description: string;
  rateCents: number | null;
  rateUnit: string;
  requirements: string | null;
  availableDays: string[];
  visible: boolean;
  active: boolean;
}

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
const RATE_UNITS = ["event", "hour", "day", "project"] as const;
const CATEGORIES = ["speaking", "teaching", "worship", "other"] as const;

export function ServicesEditor({
  channelId,
  services,
  busy: parentBusy,
}: {
  channelId: string;
  services: Service[];
  busy: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("speaking");
  const [description, setDescription] = useState("");
  const [rate, setRate] = useState("");
  const [rateUnit, setRateUnit] = useState<string>("event");
  const [requirements, setRequirements] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const input =
    "rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900";

  async function call(method: string, body: unknown): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/services", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Failed (${res.status})`);
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  const anyBusy = busy || parentBusy;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          What can be booked
        </h3>
        <button
          onClick={() => setAdding((v) => !v)}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:border-amber-500 hover:text-amber-700 dark:border-neutral-700 dark:hover:text-amber-400"
        >
          {adding ? "Close" : "Add service"}
        </button>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        Your services, rates, and available days — visible ones show on your
        public book page.
      </p>

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {adding && (
        <div className="mt-3 space-y-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="flex flex-wrap gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Service, e.g. “Sunday preaching”"
              className={`${input} min-w-0 flex-1`}
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={input}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1 rounded-lg border border-neutral-300 px-3 dark:border-neutral-700">
              <span className="text-sm text-neutral-500">$</span>
              <input
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                type="number"
                min={0}
                placeholder="rate"
                title="Leave blank for “let's talk”"
                className="w-20 bg-transparent py-2 text-sm outline-none"
              />
              <span className="text-xs text-neutral-500">/</span>
              <select
                value={rateUnit}
                onChange={(e) => setRateUnit(e.target.value)}
                className="bg-transparent py-2 text-sm outline-none"
              >
                {RATE_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={3000}
            placeholder="What this includes"
            className={`${input} w-full`}
          />
          <textarea
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            rows={2}
            maxLength={3000}
            placeholder="What the host provides (sound, lodging, travel…) — optional"
            className={`${input} w-full`}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-neutral-500">Available:</span>
            {DAYS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() =>
                  setDays((prev) =>
                    prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
                  )
                }
                className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                  days.includes(d)
                    ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                }`}
              >
                {d}
              </button>
            ))}
            <span className="text-xs text-neutral-400">(none selected = “ask”)</span>
          </div>
          <button
            disabled={anyBusy || title.trim().length < 2 || description.trim().length < 10}
            onClick={() => {
              void call("POST", {
                channelId,
                title,
                category,
                description,
                rateUnit,
                ...(rate ? { rateCents: Math.round(Number(rate) * 100) } : { rateCents: null }),
                ...(requirements.trim() ? { requirements } : {}),
                availableDays: days,
              }).then((ok) => {
                if (ok) {
                  setAdding(false);
                  setTitle("");
                  setDescription("");
                  setRequirements("");
                  setRate("");
                  setDays([]);
                }
              });
            }}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
          >
            {busy ? "Adding…" : "Add service"}
          </button>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {services.length === 0 && !adding && (
          <p className="rounded-xl border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
            No services yet — add what you can be booked for, with your rate
            and available days.
          </p>
        )}
        {services.map((s) => (
          <div
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 px-4 py-3 text-sm dark:border-neutral-800"
          >
            <div className="min-w-0">
              <span className={s.active ? "font-medium" : "font-medium line-through opacity-60"}>
                {s.title}
              </span>
              <span className="ml-2 text-xs text-neutral-500">
                {s.category}
                {s.rateCents !== null
                  ? ` · $${(s.rateCents / 100).toLocaleString()}/${s.rateUnit}`
                  : " · rate on request"}
                {s.availableDays.length > 0 && ` · ${s.availableDays.join(" ")}`}
              </span>
            </div>
            <div className="flex shrink-0 gap-2 text-xs">
              <button
                disabled={anyBusy}
                onClick={() =>
                  void call("PATCH", { channelId, serviceId: s.id, visible: !s.visible })
                }
                title="Visible services show on your public book page"
                className={
                  s.visible
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-neutral-400 hover:text-amber-700 dark:hover:text-amber-400"
                }
              >
                {s.visible ? "Visible ✓" : "Hidden"}
              </button>
              <button
                disabled={anyBusy}
                onClick={() =>
                  void call("PATCH", { channelId, serviceId: s.id, active: !s.active })
                }
                className="text-neutral-500 hover:text-amber-700 dark:hover:text-amber-400"
              >
                {s.active ? "Deactivate" : "Activate"}
              </button>
              <button
                disabled={anyBusy}
                onClick={() => void call("DELETE", { channelId, serviceId: s.id })}
                className="text-red-600 hover:underline dark:text-red-400"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
