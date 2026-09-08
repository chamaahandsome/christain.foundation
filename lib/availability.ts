// Time-slot availability (pure, tested). A service opts in by setting
// slotMinutes plus a daily window; slots then repeat on its availableDays.
// Times are wall clock in the service's own timezone — stored as minutes
// from midnight, never converted. (Maltivas' timezone math is where its
// booking bugs live; stating the zone and leaving the clock alone is both
// simpler and honest.)

export const DAY_CODES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
export type DayCode = (typeof DAY_CODES)[number];

/** "09:30" → 570. Returns null for anything malformed. */
export function parseHhMm(value: string | null | undefined): number | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** 570 → "9:30 AM" (the label signers and visitors read). */
export function formatMin(total: number): string {
  const h24 = Math.floor(total / 60) % 24;
  const m = total % 60;
  const suffix = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${suffix}`;
}

/** The day code for a date, in UTC (day keys are stored at UTC midnight). */
export function dayCodeOf(date: Date): DayCode {
  return DAY_CODES[date.getUTCDay()];
}

/** Midnight UTC of a "YYYY-MM-DD" string — the canonical day key. */
export function dayKey(ymd: string): Date | null {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0),
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface SlotConfig {
  slotMinutes: number | null;
  dailyStart: string | null;
  dailyEnd: string | null;
  bufferMins?: number;
}

export interface Slot {
  startMin: number;
  endMin: number;
  label: string;
}

/** Whether a service books by slots at all. */
export function usesSlots(config: SlotConfig): boolean {
  return (
    (config.slotMinutes ?? 0) > 0 &&
    parseHhMm(config.dailyStart) !== null &&
    parseHhMm(config.dailyEnd) !== null
  );
}

/** Every slot in the daily window: slot length plus buffer between each. */
export function generateSlots(config: SlotConfig): Slot[] {
  if (!usesSlots(config)) return [];
  const start = parseHhMm(config.dailyStart)!;
  const end = parseHhMm(config.dailyEnd)!;
  const length = config.slotMinutes!;
  const buffer = Math.max(config.bufferMins ?? 0, 0);
  const slots: Slot[] = [];
  for (
    let s = start;
    s + length <= end && slots.length < 48;
    s += length + buffer
  ) {
    slots.push({
      startMin: s,
      endMin: s + length,
      label: `${formatMin(s)} – ${formatMin(s + length)}`,
    });
  }
  return slots;
}

export interface DayAvailability {
  open: boolean;
  /** why it's closed, when it is */
  reason: "not-available-day" | "too-soon" | "too-far" | "past" | null;
  slots: (Slot & { taken: boolean })[];
}

/** Which slots a given day offers, with taken ones marked. */
export function availabilityForDay(input: {
  config: SlotConfig;
  availableDays: string[];
  leadTimeHours?: number;
  maxAdvanceDays?: number;
  date: Date;
  /** startMin values already held or booked that day */
  takenStartMins?: number[];
  now?: Date;
}): DayAvailability {
  const now = input.now ?? new Date();
  const closed = (reason: DayAvailability["reason"]): DayAvailability => ({
    open: false,
    reason,
    slots: [],
  });

  // Day keys are UTC midnight; compare on the same footing.
  const todayKey = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const dayMs = input.date.getTime();
  if (dayMs < todayKey) return closed("past");

  const maxAdvance = input.maxAdvanceDays ?? 120;
  if (dayMs > todayKey + maxAdvance * 86_400_000) return closed("too-far");

  // An empty availableDays list means "any day" (the creator hasn't
  // pinned a weekly rhythm).
  if (
    input.availableDays.length > 0 &&
    !input.availableDays.includes(dayCodeOf(input.date))
  ) {
    return closed("not-available-day");
  }

  const lead = (input.leadTimeHours ?? 24) * 3_600_000;
  const taken = new Set(input.takenStartMins ?? []);
  const slots = generateSlots(input.config)
    .map((s) => ({ ...s, taken: taken.has(s.startMin) }))
    // A slot is offered only if its start is far enough out.
    .filter((s) => dayMs + s.startMin * 60_000 >= now.getTime() + lead);

  if (slots.length === 0) {
    return closed(generateSlots(input.config).length === 0 ? null : "too-soon");
  }
  return { open: true, reason: null, slots };
}

/** Validate a chosen slot against the service — the server's last word. */
export function slotIsBookable(input: {
  config: SlotConfig;
  availableDays: string[];
  leadTimeHours?: number;
  maxAdvanceDays?: number;
  date: Date;
  startMin: number;
  takenStartMins?: number[];
  now?: Date;
}): { ok: true; endMin: number } | { ok: false; error: string } {
  const day = availabilityForDay(input);
  if (!day.open) {
    return {
      ok: false,
      error:
        day.reason === "not-available-day"
          ? "That day isn't available."
          : day.reason === "too-soon"
            ? "That time is too soon — pick a later slot."
            : day.reason === "too-far"
              ? "That date is too far ahead."
              : day.reason === "past"
                ? "That date has passed."
                : "No slots are offered that day.",
    };
  }
  const slot = day.slots.find((s) => s.startMin === input.startMin);
  if (!slot) return { ok: false, error: "That slot isn't offered." };
  if (slot.taken) return { ok: false, error: "That slot was just taken." };
  return { ok: true, endMin: slot.endMin };
}

/** How long a public hold lasts before the cron sweeps it. */
export const SLOT_HOLD_DAYS = 7;

/* ---------- month view ----------
 * The calendar colours each day the way Maltivas does: available,
 * partially booked (some slots left), fully booked, or unavailable. */

export type DayStatus =
  | "available"
  | "partial"
  | "booked"
  | "unavailable";

export function dayStatus(input: {
  config: SlotConfig;
  availableDays: string[];
  leadTimeHours?: number;
  maxAdvanceDays?: number;
  date: Date;
  takenStartMins?: number[];
  now?: Date;
}): DayStatus {
  const day = availabilityForDay(input);
  if (!day.open) {
    // A closed day still reads as "booked" when it's booked out rather
    // than simply off the schedule.
    const total = generateSlots(input.config).length;
    const taken = (input.takenStartMins ?? []).length;
    return total > 0 && taken >= total ? "booked" : "unavailable";
  }
  const free = day.slots.filter((s) => !s.taken).length;
  if (free === 0) return "booked";
  return day.slots.some((s) => s.taken) ? "partial" : "available";
}

/** Every day of a month with its status — one pass for the calendar. */
export function monthStatuses(input: {
  config: SlotConfig;
  availableDays: string[];
  leadTimeHours?: number;
  maxAdvanceDays?: number;
  year: number;
  /** 0-indexed */
  month: number;
  /** startMins already taken, keyed "YYYY-MM-DD" */
  takenByDay: Record<string, number[]>;
  now?: Date;
}): Record<string, DayStatus> {
  const out: Record<string, DayStatus> = {};
  const days = new Date(Date.UTC(input.year, input.month + 1, 0)).getUTCDate();
  for (let d = 1; d <= days; d += 1) {
    const date = new Date(Date.UTC(input.year, input.month, d));
    const ymd = date.toISOString().slice(0, 10);
    out[ymd] = dayStatus({
      config: input.config,
      availableDays: input.availableDays,
      leadTimeHours: input.leadTimeHours,
      maxAdvanceDays: input.maxAdvanceDays,
      date,
      takenStartMins: input.takenByDay[ymd] ?? [],
      now: input.now,
    });
  }
  return out;
}

/** Consecutive-run check for a day's chosen slots (the Maltivas rule). */
export function slotsAreConsecutive(startMins: number[], config: SlotConfig): boolean {
  if (startMins.length <= 1) return true;
  const all = generateSlots(config).map((s) => s.startMin);
  const idx = [...startMins]
    .sort((a, b) => a - b)
    .map((m) => all.indexOf(m));
  if (idx.some((i) => i < 0)) return false;
  return idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
}

/** Hours a set of slots adds up to. */
export function slotHours(count: number, slotMinutes: number | null): number {
  return ((slotMinutes ?? 0) * count) / 60;
}
