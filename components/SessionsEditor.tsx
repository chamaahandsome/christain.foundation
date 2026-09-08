"use client";

// Online 1:1 editor — the "Online 1:1" half of Create bookings, and the CF
// answer to Maltivas' bagel-break event form.
//
// A session is a fixed-length meeting people book straight off your page:
// you set the length, the hours you take them, and whether it's free or
// carries a fee. Booking issues a Google Calendar invite with a Meet link,
// so there is no back-and-forth to arrange.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ImageUploadDialog } from "@/components/ImageUploadDialog";
import { ThemedSelect } from "@/components/ThemedSelect";
import { generateSlots } from "@/lib/availability";
import {
  SESSION_CATEGORIES,
  SESSION_DURATIONS,
  validateSessionDraft,
} from "@/lib/sessions";

export interface SessionService {
  id: string;
  title: string;
  category: string;
  description: string;
  rateCents: number | null;
  images: string[];
  availableDays: string[];
  slotMinutes: number | null;
  dailyStart: string | null;
  dailyEnd: string | null;
  bufferMins: number;
  timezone: string;
  leadTimeHours: number;
  maxAdvanceDays: number;
  meetingProvider: string;
  meetingUrl: string | null;
  visible: boolean;
  active: boolean;
  /** confirmed bookings against this session, for the card */
  bookedCount: number;
}

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

export function SessionsEditor({
  channelId,
  sessions,
  busy: parentBusy,
  handle,
  canTakePayment,
}: {
  channelId: string;
  sessions: SessionService[];
  busy: boolean;
  handle: string;
  /** Stripe is connected and charges are enabled — a fee is chargeable */
  canTakePayment: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState<false | "new" | string>(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("mentoring");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("30");
  const [paid, setPaid] = useState(false);
  const [rate, setRate] = useState("");
  const [days, setDays] = useState<string[]>(["MON", "TUE", "WED", "THU", "FRI"]);
  const [dailyStart, setDailyStart] = useState("09:00");
  const [dailyEnd, setDailyEnd] = useState("17:00");
  const [buffer, setBuffer] = useState("0");
  const [timezone, setTimezone] = useState("");
  const [leadTimeHours, setLeadTimeHours] = useState("12");
  const [maxAdvanceDays, setMaxAdvanceDays] = useState("60");
  const [meetingProvider, setMeetingProvider] = useState("google_meet");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [imageDialog, setImageDialog] = useState(false);

  const input =
    "rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900";

  const anyBusy = busy || parentBusy;
  const rateCents = paid && rate ? Math.round(Number(rate) * 100) : null;

  // The same rules the server enforces, shown while the creator types.
  const problem = validateSessionDraft({
    title,
    description,
    slotMinutes: Number(duration),
    dailyStart,
    dailyEnd,
    rateCents,
    meetingProvider,
    meetingUrl: meetingUrl.trim() || null,
  });

  // What the window actually yields — the number that tells the creator
  // whether their day is set up the way they think it is.
  const slotsPerDay = generateSlots({
    slotMinutes: Number(duration) || null,
    dailyStart,
    dailyEnd,
    bufferMins: Number(buffer) || 0,
  }).length;

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

  function resetForm() {
    setTitle("");
    setCategory("mentoring");
    setDescription("");
    setDuration("30");
    setPaid(false);
    setRate("");
    setDays(["MON", "TUE", "WED", "THU", "FRI"]);
    setDailyStart("09:00");
    setDailyEnd("17:00");
    setBuffer("0");
    setLeadTimeHours("12");
    setMaxAdvanceDays("60");
    setMeetingProvider("google_meet");
    setMeetingUrl("");
    setImages([]);
    setTimezone(
      typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "UTC",
    );
  }

  function openEdit(s: SessionService) {
    setTitle(s.title);
    setCategory(s.category);
    setDescription(s.description);
    setDuration(String(s.slotMinutes ?? 30));
    setPaid((s.rateCents ?? 0) > 0);
    setRate(s.rateCents ? String(s.rateCents / 100) : "");
    setDays(s.availableDays);
    setDailyStart(s.dailyStart ?? "09:00");
    setDailyEnd(s.dailyEnd ?? "17:00");
    setBuffer(String(s.bufferMins));
    setTimezone(s.timezone);
    setLeadTimeHours(String(s.leadTimeHours));
    setMaxAdvanceDays(String(s.maxAdvanceDays));
    setMeetingProvider(s.meetingProvider);
    setMeetingUrl(s.meetingUrl ?? "");
    setImages(s.images);
    setFormOpen(s.id);
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Your 1:1 sessions
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
          {formOpen ? "Close" : "New session"}
        </button>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        A fixed-length online meeting people book straight from your page.
        Booking sends a Google Calendar invite with a Meet link to both of
        you — free, or paid up front.
      </p>

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {formOpen && (
        <div className="mt-3 space-y-4 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
          {/* What it is */}
          <div className="flex flex-wrap gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Session, e.g. “Discipleship call”"
              className={`${input} min-w-0 flex-1`}
            />
            <ThemedSelect
              value={category}
              onChange={setCategory}
              options={SESSION_CATEGORIES.map((c) => ({ value: c, label: c }))}
              className="w-40"
            />
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={3000}
            placeholder="What this session is for, and who it's for"
            className={`${input} w-full`}
          />

          {/* How long, and what it costs */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
              <p className="text-xs font-medium text-neutral-500">Length</p>
              <div className="mt-2">
                <ThemedSelect
                  value={duration}
                  onChange={setDuration}
                  options={SESSION_DURATIONS.map((m) => ({
                    value: String(m),
                    label: `${m} minutes`,
                  }))}
                  className="w-full"
                />
              </div>
              <p className="mt-2 text-[11px] text-neutral-400">
                Every booking takes exactly one slot of this length.
              </p>
            </div>

            <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
              <p className="text-xs font-medium text-neutral-500">Price</p>
              <div className="mt-2 flex gap-1.5">
                {(
                  [
                    [false, "Free"],
                    [true, "Paid"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setPaid(value)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                      paid === value
                        ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {paid && (
                <div className="mt-2 flex items-center gap-1 rounded-lg border border-neutral-300 px-3 dark:border-neutral-700">
                  <span className="text-sm text-neutral-500">$</span>
                  <input
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    type="number"
                    min={1}
                    placeholder="25"
                    className="w-24 bg-transparent py-2 text-sm outline-none"
                  />
                  <span className="text-xs text-neutral-500">per session</span>
                </div>
              )}
              <p className="mt-2 text-[11px] text-neutral-400">
                {paid
                  ? canTakePayment
                    ? "Paid before the slot is confirmed. CF's cut is 5%."
                    : "⚠ Connect payouts under Payments before a paid session can be booked."
                  : "Confirmed the moment someone picks a time."}
              </p>
            </div>
          </div>

          {/* When you take them */}
          <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
            <p className="text-xs font-medium text-neutral-500">
              When you take these meetings
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
              <span className="text-xs text-neutral-400">
                (none selected = every day)
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
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
              <span>with</span>
              <div className="flex items-center gap-1 rounded-lg border border-neutral-300 px-3 dark:border-neutral-700">
                <input
                  value={buffer}
                  onChange={(e) => setBuffer(e.target.value)}
                  type="number"
                  min={0}
                  max={120}
                  className="w-14 bg-transparent py-2 text-sm outline-none"
                />
                <span className="text-xs text-neutral-500">min gap between</span>
              </div>
            </div>
            <input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="Timezone, e.g. America/Chicago"
              className={`${input} mt-2 w-full`}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
              <span>Book at least</span>
              <div className="flex items-center gap-1 rounded-lg border border-neutral-300 px-3 dark:border-neutral-700">
                <input
                  value={leadTimeHours}
                  onChange={(e) => setLeadTimeHours(e.target.value)}
                  type="number"
                  min={0}
                  className="w-14 bg-transparent py-2 text-sm outline-none"
                />
                <span className="text-xs text-neutral-500">hours ahead</span>
              </div>
              <span>and no more than</span>
              <div className="flex items-center gap-1 rounded-lg border border-neutral-300 px-3 dark:border-neutral-700">
                <input
                  value={maxAdvanceDays}
                  onChange={(e) => setMaxAdvanceDays(e.target.value)}
                  type="number"
                  min={1}
                  className="w-14 bg-transparent py-2 text-sm outline-none"
                />
                <span className="text-xs text-neutral-500">days out</span>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-neutral-400">
              {slotsPerDay > 0
                ? `That's ${slotsPerDay} slot${slotsPerDay === 1 ? "" : "s"} on each available day, shown to visitors in ${timezone || "UTC"}.`
                : "That window is too short for a session of this length."}
            </p>
          </div>

          {/* Where you meet */}
          <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
            <p className="text-xs font-medium text-neutral-500">Where you meet</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(
                [
                  ["google_meet", "Google Meet (created for you)"],
                  ["custom", "My own room link"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMeetingProvider(value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                    meetingProvider === value
                      ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder={
                meetingProvider === "custom"
                  ? "https://… your standing meeting room"
                  : "https://… fallback room (optional)"
              }
              className={`${input} mt-2 w-full`}
            />
            <p className="mt-1 text-[11px] text-neutral-400">
              {meetingProvider === "google_meet"
                ? "Each booking raises an event on your Google Calendar with a fresh Meet link and invites you both. Connect Google to your CF sign-in for this; if it isn't connected, the fallback link above is used."
                : "Every booking uses this link. No calendar access needed."}
            </p>
          </div>

          {/* Cover image */}
          <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
            <p className="text-xs font-medium text-neutral-500">
              Cover image (optional)
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
              {images.length < 1 && (
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

          {problem && <p className="text-xs text-amber-700 dark:text-amber-400">{problem}</p>}

          <button
            disabled={anyBusy || problem !== null}
            onClick={() => {
              const editing = formOpen !== "new" ? formOpen : null;
              const payload = {
                channelId,
                kind: "ONLINE" as const,
                title,
                category,
                description,
                rateCents,
                availableDays: days,
                images,
                slotMinutes: Number(duration),
                dailyStart,
                dailyEnd,
                bufferMins: Number(buffer) || 0,
                timezone: timezone || "UTC",
                leadTimeHours: Number(leadTimeHours) || 0,
                maxAdvanceDays: Number(maxAdvanceDays) || 60,
                meetingProvider,
                meetingUrl: meetingUrl.trim() || null,
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
            {busy ? "Saving…" : formOpen !== "new" ? "Save changes" : "Create session"}
          </button>
        </div>
      )}

      <ImageUploadDialog
        open={imageDialog}
        title="Session cover"
        channelId={channelId}
        aspect={16 / 9}
        allowRemove={false}
        onCancel={() => setImageDialog(false)}
        onDone={(url) => {
          setImageDialog(false);
          if (url) setImages([url]);
        }}
      />

      {sessions.length === 0 && !formOpen && (
        <div className="mt-3 rounded-xl border border-dashed border-neutral-300 p-8 text-center dark:border-neutral-700">
          <p className="text-3xl">🎧</p>
          <h4 className="mt-2 text-sm font-semibold">No 1:1 sessions yet</h4>
          <p className="mx-auto mt-1 max-w-md text-xs text-neutral-500">
            Offer a call people can book without asking — mentoring, prayer, a
            discipleship check-in. Set the length and your hours, and CF sends
            the calendar invite and meeting link for you.
          </p>
        </div>
      )}

      <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`group overflow-hidden rounded-2xl border transition-all hover:-translate-y-0.5 hover:shadow-lg ${
              s.active
                ? "border-neutral-200 dark:border-neutral-700"
                : "border-dashed border-neutral-300 opacity-70 dark:border-neutral-700"
            }`}
          >
            <div className="relative h-32 w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
              {s.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.images[0]}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-linear-to-br from-amber-100 to-orange-100 text-3xl opacity-50 dark:from-amber-950 dark:to-orange-950">
                  🎧
                </span>
              )}
              <div className="absolute inset-0 bg-linear-to-t from-black/45 to-transparent" />
              <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                <span className="rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
                  {s.category}
                </span>
                {!s.visible && (
                  <span className="rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
                    Hidden
                  </span>
                )}
              </div>
              <p className="absolute bottom-2 left-3 text-sm font-bold text-white drop-shadow">
                {s.slotMinutes} min ·{" "}
                {s.rateCents && s.rateCents > 0
                  ? `$${(s.rateCents / 100).toLocaleString()}`
                  : "Free"}
              </p>
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

              <div className="rounded-xl border border-neutral-200 p-3 text-[11px] text-neutral-500 dark:border-neutral-700">
                <p>
                  {s.dailyStart}–{s.dailyEnd} ({s.timezone})
                </p>
                <p className="mt-0.5">
                  {s.availableDays.length > 0 ? s.availableDays.join(" ") : "Any day"}
                </p>
                <p className="mt-0.5">
                  {s.meetingProvider === "custom"
                    ? "Your own room link"
                    : "Google Meet link per booking"}
                </p>
                {s.bookedCount > 0 && (
                  <p className="mt-1 font-medium text-amber-700 dark:text-amber-400">
                    {s.bookedCount} booked
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
                <a
                  href={`/@${handle}/book/${s.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-neutral-500 hover:text-amber-700 dark:hover:text-amber-400"
                >
                  Preview
                </a>
                <button
                  disabled={anyBusy}
                  onClick={() =>
                    void call("PATCH", { channelId, serviceId: s.id, visible: !s.visible })
                  }
                  title="Visible sessions show on your public booking page"
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
                  {s.active ? "Pause" : "Resume"}
                </button>
                <button
                  disabled={anyBusy || s.bookedCount > 0}
                  title={
                    s.bookedCount > 0
                      ? "Sessions are already booked — pause it instead"
                      : undefined
                  }
                  onClick={() => void call("DELETE", { channelId, serviceId: s.id })}
                  className="ml-auto text-red-600 hover:underline disabled:opacity-40 disabled:hover:no-underline dark:text-red-400"
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
