import { describe, expect, it } from "vitest";
import { bookingSlot, parseBookingSlots } from "@/lib/bookings";
import {
  appointmentSortKey,
  appointmentState,
  appointmentStatusLabel,
  appointmentWhen,
  canJoinNow,
  partitionAppointments,
  tableIsEmpty,
} from "@/lib/table";

const NOW = new Date("2026-09-10T12:00:00Z");
const slot = { ymd: "2026-09-11", startMin: 540, endMin: 570 };

describe("parseBookingSlots", () => {
  it("reads the stored selection, earliest first", () => {
    expect(
      parseBookingSlots({
        eventDate: null,
        slotStartMin: null,
        slotSelections: [
          { date: "2026-09-12", startMin: 600, endMin: 630 },
          { date: "2026-09-11", startMin: 540, endMin: 570 },
        ],
      }),
    ).toEqual([
      { ymd: "2026-09-11", startMin: 540, endMin: 570 },
      { ymd: "2026-09-12", startMin: 600, endMin: 630 },
    ]);
  });

  it("falls back to the single-slot shape on older rows", () => {
    expect(
      parseBookingSlots({
        eventDate: new Date("2026-09-11T00:00:00Z"),
        slotStartMin: 540,
        slotSelections: null,
      }),
    ).toEqual([{ ymd: "2026-09-11", startMin: 540, endMin: 570 }]);
  });

  it("drops malformed rows and returns nothing when no time is agreed", () => {
    expect(
      parseBookingSlots({
        eventDate: null,
        slotStartMin: null,
        slotSelections: [{ date: 5 }, null, "nope", { startMin: 9 }],
      }),
    ).toEqual([]);
    expect(
      bookingSlot({ eventDate: null, slotStartMin: null, slotSelections: undefined }),
    ).toBeNull();
  });
});

describe("appointmentState", () => {
  it("reads agreed bookings that are still ahead as upcoming", () => {
    expect(appointmentState({ status: "CONFIRMED", slot, now: NOW })).toBe("UPCOMING");
    expect(appointmentState({ status: "ACCEPTED", slot, now: NOW })).toBe("UPCOMING");
  });

  it("treats an unsettled request as awaiting, slot held or not", () => {
    expect(appointmentState({ status: "PENDING", slot, now: NOW })).toBe("AWAITING");
    expect(appointmentState({ status: "QUOTED", slot: null, now: NOW })).toBe("AWAITING");
  });

  it("moves a booking to past once its time has gone by", () => {
    const gone = { ymd: "2026-09-09", startMin: 540, endMin: 570 };
    expect(appointmentState({ status: "CONFIRMED", slot: gone, now: NOW })).toBe("PAST");
    expect(appointmentState({ status: "COMPLETED", slot: null, now: NOW })).toBe("PAST");
  });

  it("keeps declined and cancelled out of the live rooms", () => {
    expect(appointmentState({ status: "CANCELLED", slot, now: NOW })).toBe("CLOSED");
    expect(appointmentState({ status: "DECLINED", slot: null, now: NOW })).toBe("CLOSED");
  });
});

describe("appointmentStatusLabel", () => {
  it("speaks to the guest, not the creator", () => {
    expect(
      appointmentStatusLabel({
        kind: "HIRE",
        status: "PENDING",
        state: "AWAITING",
      }),
    ).toBe("Sent — not yet read");
    expect(
      appointmentStatusLabel({ kind: "HIRE", status: "QUOTED", state: "AWAITING" }),
    ).toBe("Quote sent to you");
  });

  it("separates a paid 1:1 from one still waiting on the card", () => {
    expect(
      appointmentStatusLabel({
        kind: "ONLINE",
        status: "CONFIRMED",
        state: "UPCOMING",
        paymentStatus: "paid",
      }),
    ).toBe("Confirmed · paid");
    expect(
      appointmentStatusLabel({
        kind: "ONLINE",
        status: "PENDING",
        state: "AWAITING",
        paymentStatus: "pending",
      }),
    ).toBe("Waiting on payment");
  });
});

describe("appointmentWhen", () => {
  it("labels the time in the service's own zone", () => {
    expect(appointmentWhen(slot, "America/Chicago", "en-US")).toBe(
      "Fri, Sep 11 · 9:00 AM – 9:30 AM (America/Chicago)",
    );
  });

  it("says nothing when no time is agreed", () => {
    expect(appointmentWhen(null, "UTC")).toBeNull();
  });
});

describe("partitionAppointments", () => {
  it("reads upcoming forwards and everything else backwards", () => {
    const rows = [
      { id: "far", state: "UPCOMING" as const, slot: { ymd: "2026-09-20", startMin: 540, endMin: 570 }, createdAt: NOW },
      { id: "soon", state: "UPCOMING" as const, slot, createdAt: NOW },
      { id: "askedFirst", state: "AWAITING" as const, slot: null, createdAt: new Date("2026-09-01T00:00:00Z") },
      { id: "askedLast", state: "AWAITING" as const, slot: null, createdAt: new Date("2026-09-08T00:00:00Z") },
      { id: "done", state: "PAST" as const, slot: null, createdAt: new Date("2026-08-01T00:00:00Z") },
      { id: "dropped", state: "CLOSED" as const, slot: null, createdAt: new Date("2026-08-20T00:00:00Z") },
    ];
    const out = partitionAppointments(rows);
    expect(out.upcoming.map((r) => r.id)).toEqual(["soon", "far"]);
    expect(out.awaiting.map((r) => r.id)).toEqual(["askedLast", "askedFirst"]);
    expect(out.past.map((r) => r.id)).toEqual(["dropped", "done"]);
  });

  it("falls back to when it was asked for when there is no slot", () => {
    expect(appointmentSortKey({ slot: null, createdAt: NOW })).toBe(NOW.getTime());
    expect(appointmentSortKey({ slot, createdAt: NOW })).toBe(
      Date.parse("2026-09-11T09:00:00Z"),
    );
  });
});

describe("canJoinNow", () => {
  const url = "https://meet.google.com/abc-defg-hij";

  it("opens the door a quarter hour early and shuts it at the end", () => {
    const at = (iso: string) =>
      canJoinNow({ slot, meetingUrl: url, state: "UPCOMING", now: new Date(iso) });
    expect(at("2026-09-11T08:44:00Z")).toBe(false);
    expect(at("2026-09-11T08:45:00Z")).toBe(true);
    expect(at("2026-09-11T09:29:00Z")).toBe(true);
    expect(at("2026-09-11T09:31:00Z")).toBe(false);
  });

  it("stays shut without a link, a time, or an agreement", () => {
    const now = new Date("2026-09-11T09:00:00Z");
    expect(canJoinNow({ slot, meetingUrl: null, state: "UPCOMING", now })).toBe(false);
    expect(canJoinNow({ slot: null, meetingUrl: url, state: "UPCOMING", now })).toBe(false);
    expect(canJoinNow({ slot, meetingUrl: url, state: "AWAITING", now })).toBe(false);
  });
});

describe("tableIsEmpty", () => {
  it("is empty only when every room is", () => {
    expect(tableIsEmpty({ appointments: 0, books: 0, backed: 0, following: 0 })).toBe(true);
    expect(tableIsEmpty({ appointments: 0, books: 0, backed: 0, following: 2 })).toBe(false);
  });
});
