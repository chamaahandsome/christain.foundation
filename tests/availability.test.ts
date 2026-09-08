import { describe, expect, it } from "vitest";
import {
  availabilityForDay,
  dayCodeOf,
  dayKey,
  formatMin,
  generateSlots,
  parseHhMm,
  slotIsBookable,
  usesSlots,
} from "@/lib/availability";

const CONFIG = { slotMinutes: 60, dailyStart: "09:00", dailyEnd: "12:00", bufferMins: 0 };

describe("time helpers", () => {
  it("parses and formats wall clock", () => {
    expect(parseHhMm("09:30")).toBe(570);
    expect(parseHhMm("9:05")).toBe(545);
    expect(parseHhMm("24:00")).toBeNull();
    expect(parseHhMm("nope")).toBeNull();
    expect(parseHhMm(null)).toBeNull();
    expect(formatMin(570)).toBe("9:30 AM");
    expect(formatMin(720)).toBe("12:00 PM");
    expect(formatMin(0)).toBe("12:00 AM");
    expect(formatMin(1305)).toBe("9:45 PM");
  });
  it("day keys are UTC midnight with the right day code", () => {
    const d = dayKey("2026-09-13")!; // a Sunday
    expect(d.toISOString()).toBe("2026-09-13T00:00:00.000Z");
    expect(dayCodeOf(d)).toBe("SUN");
    expect(dayKey("garbage")).toBeNull();
  });
});

describe("generateSlots", () => {
  it("fills the window at slot length", () => {
    expect(generateSlots(CONFIG).map((s) => s.label)).toEqual([
      "9:00 AM – 10:00 AM",
      "10:00 AM – 11:00 AM",
      "11:00 AM – 12:00 PM",
    ]);
  });
  it("honors buffers and never overruns the window", () => {
    const slots = generateSlots({ ...CONFIG, slotMinutes: 45, bufferMins: 15 });
    expect(slots.map((s) => s.startMin)).toEqual([540, 600, 660]);
    expect(slots.at(-1)!.endMin).toBeLessThanOrEqual(720);
  });
  it("returns nothing when slots aren't configured", () => {
    expect(usesSlots({ slotMinutes: null, dailyStart: "09:00", dailyEnd: "17:00" })).toBe(false);
    expect(generateSlots({ slotMinutes: 60, dailyStart: null, dailyEnd: "17:00" })).toEqual([]);
  });
});

describe("availabilityForDay", () => {
  const now = new Date("2026-09-10T08:00:00Z"); // Thursday
  const base = {
    config: CONFIG,
    availableDays: ["SUN", "SAT"],
    leadTimeHours: 24,
    maxAdvanceDays: 30,
    now,
  };
  it("closes days outside the weekly rhythm", () => {
    const d = availabilityForDay({ ...base, date: dayKey("2026-09-11")! }); // Friday
    expect(d.open).toBe(false);
    expect(d.reason).toBe("not-available-day");
  });
  it("opens an available day and marks taken slots", () => {
    const d = availabilityForDay({
      ...base,
      date: dayKey("2026-09-12")!, // Saturday
      takenStartMins: [600],
    });
    expect(d.open).toBe(true);
    expect(d.slots.map((s) => s.taken)).toEqual([false, true, false]);
  });
  it("respects lead time, past days and the advance horizon", () => {
    // same-day, inside the 24h lead → nothing offered
    const today = availabilityForDay({ ...base, availableDays: [], date: dayKey("2026-09-10")! });
    expect(today.open).toBe(false);
    expect(availabilityForDay({ ...base, availableDays: [], date: dayKey("2026-09-09")! }).reason).toBe("past");
    expect(availabilityForDay({ ...base, availableDays: [], date: dayKey("2026-12-25")! }).reason).toBe("too-far");
  });
  it("empty availableDays means any day", () => {
    expect(
      availabilityForDay({ ...base, availableDays: [], date: dayKey("2026-09-11")! }).open,
    ).toBe(true);
  });
});

describe("slotIsBookable", () => {
  const base = {
    config: CONFIG,
    availableDays: ["SAT"],
    leadTimeHours: 24,
    maxAdvanceDays: 30,
    date: dayKey("2026-09-12")!,
    now: new Date("2026-09-10T08:00:00Z"),
  };
  it("accepts an offered, free slot and returns its end", () => {
    expect(slotIsBookable({ ...base, startMin: 540 })).toEqual({ ok: true, endMin: 600 });
  });
  it("rejects taken, unknown, and closed-day slots", () => {
    expect(slotIsBookable({ ...base, startMin: 540, takenStartMins: [540] })).toEqual({
      ok: false,
      error: "That slot was just taken.",
    });
    expect(slotIsBookable({ ...base, startMin: 555 }).ok).toBe(false);
    expect(
      slotIsBookable({ ...base, date: dayKey("2026-09-11")!, startMin: 540 }),
    ).toEqual({ ok: false, error: "That day isn't available." });
  });
});

import { dayStatus, monthStatuses, slotHours, slotsAreConsecutive } from "@/lib/availability";

describe("dayStatus / monthStatuses", () => {
  const base = {
    config: CONFIG, // 3 slots: 540, 600, 660
    availableDays: ["SAT"],
    leadTimeHours: 24,
    maxAdvanceDays: 60,
    now: new Date("2026-09-10T08:00:00Z"),
  };
  it("reads available, partial, booked and unavailable", () => {
    const sat = dayKey("2026-09-12")!;
    expect(dayStatus({ ...base, date: sat })).toBe("available");
    expect(dayStatus({ ...base, date: sat, takenStartMins: [600] })).toBe("partial");
    expect(dayStatus({ ...base, date: sat, takenStartMins: [540, 600, 660] })).toBe("booked");
    expect(dayStatus({ ...base, date: dayKey("2026-09-11")! })).toBe("unavailable");
  });
  it("paints a whole month in one pass", () => {
    const map = monthStatuses({
      ...base,
      year: 2026,
      month: 8, // September
      takenByDay: { "2026-09-19": [540, 600, 660] },
    });
    expect(map["2026-09-12"]).toBe("available"); // Saturday
    expect(map["2026-09-14"]).toBe("unavailable"); // Monday
    expect(map["2026-09-19"]).toBe("booked"); // Saturday, full
    expect(Object.keys(map)).toHaveLength(30);
  });
});

describe("slotsAreConsecutive / slotHours", () => {
  it("requires an unbroken run", () => {
    expect(slotsAreConsecutive([540], CONFIG)).toBe(true);
    expect(slotsAreConsecutive([540, 600], CONFIG)).toBe(true);
    expect(slotsAreConsecutive([600, 540], CONFIG)).toBe(true); // order-independent
    expect(slotsAreConsecutive([540, 660], CONFIG)).toBe(false); // gap
    expect(slotsAreConsecutive([540, 555], CONFIG)).toBe(false); // unknown slot
  });
  it("totals hours", () => {
    expect(slotHours(3, 60)).toBe(3);
    expect(slotHours(2, 45)).toBe(1.5);
    expect(slotHours(1, null)).toBe(0);
  });
});
