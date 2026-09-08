"use client";

// Do-Biz bookable services editor: what can be booked, rates, available
// days, and visibility on the public book page.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ImageUploadDialog } from "@/components/ImageUploadDialog";
import { ThemedSelect } from "@/components/ThemedSelect";

export interface Service {
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
  dailyStart: string | null;
  dailyEnd: string | null;
  timezone: string;
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
  // "new" opens a blank form; a service id opens it prefilled for editing
  const [formOpen, setFormOpen] = useState<false | "new" | string>(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("speaking");
  const [description, setDescription] = useState("");
  const [rate, setRate] = useState("");
  const [rateUnit, setRateUnit] = useState<string>("event");
  const [privateRate, setPrivateRate] = useState(false);
  const [requirements, setRequirements] = useState("");
  const [days, setDays] = useState<string[]>([]);
  const [duration, setDuration] = useState("");
  const [extras, setExtras] = useState<{ name: string; priceCents: number | null }[]>([]);
  const [extraName, setExtraName] = useState("");
  const [extraPrice, setExtraPrice] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [imageDialog, setImageDialog] = useState(false);
  const [slotsOn, setSlotsOn] = useState(false);
  const [slotMinutes, setSlotMinutes] = useState("60");
  const [dailyStart, setDailyStart] = useState("09:00");
  const [dailyEnd, setDailyEnd] = useState("17:00");
  const [timezone, setTimezone] = useState("");
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

  function resetForm() {
    setTitle("");
    setCategory("speaking");
    setDescription("");
    setRequirements("");
    setRate("");
    setPrivateRate(false);
    setRateUnit("event");
    setDays([]);
    setDuration("");
    setExtras([]);
    setExtraName("");
    setExtraPrice("");
    setImages([]);
    setSlotsOn(false);
    setSlotMinutes("60");
    setDailyStart("09:00");
    setDailyEnd("17:00");
    setTimezone(
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "UTC",
    );
  }
  function openEdit(s: Service) {
    setTitle(s.title);
    setCategory(s.category);
    setDescription(s.description);
    setRequirements(s.requirements ?? "");
    setRate(s.rateCents !== null ? String(s.rateCents / 100) : "");
    setRateUnit(s.rateUnit);
    setPrivateRate(s.privateRate);
    setDays(s.availableDays);
    setDuration(s.durationMins !== null ? String(s.durationMins) : "");
    setExtras(s.extras);
    setImages(s.images);
    setSlotsOn(s.slotMinutes !== null);
    setSlotMinutes(s.slotMinutes !== null ? String(s.slotMinutes) : "60");
    setDailyStart(s.dailyStart ?? "09:00");
    setDailyEnd(s.dailyEnd ?? "17:00");
    setTimezone(s.timezone);
    setFormOpen(s.id);
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          What can be booked
        </h3>
        <button
          onClick={() => {
            if (formOpen) setFormOpen(false);
            else {
              resetForm();
              setFormOpen("new");
            }
          }}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:border-amber-500 hover:text-amber-700 dark:border-neutral-700 dark:hover:text-amber-400"
        >
          {formOpen ? "Close" : "Add service"}
        </button>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        Your services, rates, and available days — visible ones show on your
        public book page.
      </p>

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {formOpen && (
        <div className="mt-3 space-y-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
          <div className="flex flex-wrap gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Service, e.g. “Sunday preaching”"
              className={`${input} min-w-0 flex-1`}
            />
            <ThemedSelect
              value={category}
              onChange={setCategory}
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
              className="w-36"
            />
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
            </div>
            <ThemedSelect
              value={rateUnit}
              onChange={setRateUnit}
              options={RATE_UNITS.map((u) => ({ value: u, label: u }))}
              className="w-28"
            />
          </div>
          {/* Showing the rate is optional — keep it private and the public
              card reads "Price on request" while you still quote from it. */}
          <label
            className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm ${
              rate
                ? "cursor-pointer border-neutral-200 dark:border-neutral-700"
                : "cursor-not-allowed border-dashed border-neutral-200 opacity-60 dark:border-neutral-800"
            }`}
          >
            <input
              type="checkbox"
              checked={privateRate}
              disabled={!rate}
              onChange={(e) => setPrivateRate(e.target.checked)}
              className="h-4 w-4 accent-amber-600"
            />
            <span className="min-w-0">
              <span className="font-medium">Keep the rate private</span>
              <span className="mt-0.5 block text-xs leading-5 text-neutral-500">
                {rate
                  ? "Visitors see “Price on request” instead of the amount. You still quote from it."
                  : "Leave the rate blank and it already reads “Price on request”."}
              </span>
            </span>
          </label>
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-neutral-500">Typical length:</span>
            <div className="flex items-center gap-1 rounded-lg border border-neutral-300 px-3 dark:border-neutral-700">
              <input
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                type="number"
                min={0}
                placeholder="60"
                className="w-16 bg-transparent py-2 text-sm outline-none"
              />
              <span className="text-xs text-neutral-500">minutes (optional)</span>
            </div>
          </div>

          {/* Showcase images (up to 3) for the public service card */}
          <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
            <p className="text-xs font-medium text-neutral-500">
              Photos (optional) — shown on your public booking page
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {images.map((url) => (
                <div
                  key={url}
                  className="group relative h-16 w-24 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages((list) => list.filter((u) => u !== url))}
                    className="absolute right-0.5 top-0.5 hidden h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white group-hover:flex"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {images.length < 3 && (
                <button
                  type="button"
                  onClick={() => setImageDialog(true)}
                  className="h-16 w-24 rounded-lg border border-dashed border-neutral-300 text-xs text-neutral-500 hover:border-amber-500 hover:text-amber-700 dark:border-neutral-700 dark:hover:text-amber-400"
                >
                  + Photo
                </button>
              )}
            </div>
          </div>

          {/* Optional add-ons the requester can select */}
          <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
            <p className="text-xs font-medium text-neutral-500">
              Add-ons (optional) — requesters can tick these when booking
            </p>
            {extras.length > 0 && (
              <ul className="mt-2 space-y-1">
                {extras.map((x, i) => (
                  <li
                    key={`${x.name}-${i}`}
                    className="flex items-center justify-between gap-2 rounded-lg bg-neutral-50 px-3 py-1.5 text-sm dark:bg-neutral-800/60"
                  >
                    <span>
                      {x.name}
                      <span className="ml-2 text-xs text-neutral-500">
                        {x.priceCents !== null
                          ? `+$${(x.priceCents / 100).toLocaleString()}`
                          : "price on request"}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setExtras((list) => list.filter((_, j) => j !== i))}
                      className="rounded-md px-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                value={extraName}
                onChange={(e) => setExtraName(e.target.value)}
                placeholder="Add-on, e.g. “Livestream feed”"
                className={`${input} min-w-0 flex-1`}
              />
              <div className="flex items-center gap-1 rounded-lg border border-neutral-300 px-3 dark:border-neutral-700">
                <span className="text-sm text-neutral-500">+$</span>
                <input
                  value={extraPrice}
                  onChange={(e) => setExtraPrice(e.target.value)}
                  type="number"
                  min={0}
                  placeholder="0"
                  className="w-20 bg-transparent py-2 text-sm outline-none"
                />
              </div>
              <button
                type="button"
                disabled={!extraName.trim()}
                onClick={() => {
                  setExtras((list) => [
                    ...list,
                    {
                      name: extraName.trim(),
                      priceCents: extraPrice ? Math.round(Number(extraPrice) * 100) : null,
                    },
                  ]);
                  setExtraName("");
                  setExtraPrice("");
                }}
                className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-medium hover:border-amber-500 hover:text-amber-700 disabled:opacity-50 dark:border-neutral-700 dark:hover:text-amber-400"
              >
                Add
              </button>
            </div>
          </div>

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

          {/* Time slots — opt in to booking fixed times on those days */}
          <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
            <label className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">
              <input
                type="checkbox"
                checked={slotsOn}
                onChange={(e) => setSlotsOn(e.target.checked)}
                className="h-3.5 w-3.5 accent-amber-600"
              />
              Let people book a specific time slot
            </label>
            {slotsOn ? (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                  <span>From</span>
                  <input
                    value={dailyStart}
                    onChange={(e) => setDailyStart(e.target.value)}
                    type="time"
                    className={input}
                  />
                  <span>to</span>
                  <input
                    value={dailyEnd}
                    onChange={(e) => setDailyEnd(e.target.value)}
                    type="time"
                    className={input}
                  />
                  <span>in</span>
                  <ThemedSelect
                    value={slotMinutes}
                    onChange={setSlotMinutes}
                    options={["30", "45", "60", "90", "120"].map((m) => ({
                      value: m,
                      label: `${m} min slots`,
                    }))}
                    className="w-40"
                  />
                </div>
                <input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="Timezone, e.g. America/Chicago"
                  className={`${input} mt-2 w-full`}
                />
                <p className="mt-1 text-[11px] text-neutral-400">
                  Slots repeat on the days selected above and are shown to
                  visitors in this timezone. Requests hold the slot for 7 days;
                  accepting confirms it.
                </p>
              </>
            ) : (
              <p className="mt-1 text-[11px] text-neutral-400">
                Off — visitors send an open request and you agree the timing
                between you.
              </p>
            )}
          </div>
          <button
            disabled={anyBusy || title.trim().length < 2 || description.trim().length < 10}
            onClick={() => {
              const editing = formOpen !== "new" ? formOpen : null;
              const payload = {
                channelId,
                title,
                category,
                description,
                rateUnit,
                rateCents: rate ? Math.round(Number(rate) * 100) : null,
                privateRate,
                requirements: requirements.trim() || null,
                availableDays: days,
                durationMins: duration ? Number(duration) : null,
                extras,
                images,
                slotMinutes: slotsOn ? Number(slotMinutes) : null,
                dailyStart: slotsOn ? dailyStart : null,
                dailyEnd: slotsOn ? dailyEnd : null,
                timezone: timezone || "UTC",
              };
              void call(
                editing ? "PATCH" : "POST",
                editing ? { ...payload, serviceId: editing } : payload,
              ).then((ok) => {
                if (ok) {
                  setFormOpen(false);
                  resetForm();
                }
              });
            }}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
          >
            {busy
              ? "Saving…"
              : formOpen !== "new"
                ? "Save changes"
                : "Add service"}
          </button>
        </div>
      )}

      <ImageUploadDialog
        open={imageDialog}
        title="Service photo"
        channelId={channelId}
        aspect={16 / 9}
        allowRemove={false}
        onCancel={() => setImageDialog(false)}
        onDone={(url) => {
          setImageDialog(false);
          if (url) setImages((list) => [...list, url].slice(0, 3));
        }}
      />

      {services.length === 0 && !formOpen && (
        <p className="mt-3 rounded-xl border border-dashed border-neutral-300 p-6 text-center text-xs text-neutral-500 dark:border-neutral-700">
          No services yet — add what you can be booked for, with your rate and
          available days.
        </p>
      )}

      {/* Service cards (the Maltivas grid): photo header with category
          badge, then title, rate, and the actions. */}
      <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((s) => (
          <div
            key={s.id}
            className={`group overflow-hidden rounded-2xl border transition-all hover:-translate-y-0.5 hover:shadow-lg ${
              s.active
                ? "border-neutral-200 dark:border-neutral-700"
                : "border-dashed border-neutral-300 opacity-70 dark:border-neutral-700"
            }`}
          >
            <div className="relative h-40 w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
              {s.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.images[0]}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-3xl opacity-30">
                  📅
                </span>
              )}
              <div className="absolute inset-0 bg-linear-to-t from-black/45 to-transparent" />
              <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                <span className="rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
                  {s.category}
                </span>
                <span className="flex shrink-0 gap-1.5">
                  {s.privateRate && s.rateCents !== null && (
                    <span className="rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
                      Private rate
                    </span>
                  )}
                  {!s.visible && (
                    <span className="rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
                      Hidden
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div className="space-y-3 p-4">
              <div>
                <h4 className={`font-bold leading-tight ${s.active ? "" : "line-through"}`}>
                  {s.title}
                </h4>
                <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-neutral-500">
                  {s.description}
                </p>
              </div>

              <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  Rate
                  {s.privateRate && s.rateCents !== null && (
                    <span className="normal-case tracking-normal text-neutral-400">
                      {" "}
                      · shown as “Price on request”
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm font-semibold">
                  {s.rateCents !== null
                    ? `$${(s.rateCents / 100).toLocaleString()}`
                    : "On request"}
                  {s.rateCents !== null && (
                    <span className="text-xs font-normal text-neutral-500">
                      /{s.rateUnit}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-[11px] text-neutral-500">
                  {s.slotMinutes
                    ? `${s.slotMinutes} min slots · ${s.dailyStart}–${s.dailyEnd}`
                    : s.durationMins
                      ? `About ${s.durationMins} min`
                      : "Timing agreed together"}
                  {s.availableDays.length > 0 && ` · ${s.availableDays.join(" ")}`}
                </p>
                {s.extras.length > 0 && (
                  <p className="mt-1 text-[11px] text-neutral-500">
                    {s.extras.length} add-on{s.extras.length > 1 ? "s" : ""}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  disabled={anyBusy}
                  onClick={() => openEdit(s)}
                  className={`rounded-lg border px-3 py-1.5 font-medium ${
                    formOpen === s.id
                      ? "border-amber-500 text-amber-700 dark:text-amber-400"
                      : "border-neutral-300 hover:border-amber-500 hover:text-amber-700 dark:border-neutral-700 dark:hover:text-amber-400"
                  }`}
                >
                  {formOpen === s.id ? "Editing…" : "Edit"}
                </button>
                <button
                  disabled={anyBusy}
                  onClick={() =>
                    void call("PATCH", { channelId, serviceId: s.id, visible: !s.visible })
                  }
                  title="Visible services show on your public booking page"
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
                  className="ml-auto text-red-600 hover:underline dark:text-red-400"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
