// Bookable-service extras and images (pure, tested). Extras are optional
// add-ons a requester can select; images showcase the service publicly.

export interface ServiceExtra {
  name: string;
  priceCents: number | null;
}

/** Parse the stored extras JSON, dropping malformed rows and dedupe by name. */
export function parseServiceExtras(raw: unknown): ServiceExtra[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ServiceExtra[] = [];
  for (const row of raw.slice(0, 20)) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim().slice(0, 150) : "";
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const priceCents =
      typeof r.priceCents === "number" && Number.isFinite(r.priceCents)
        ? Math.min(Math.max(Math.round(r.priceCents), 0), 100_000_000)
        : null;
    out.push({ name, priceCents });
  }
  return out;
}

/** Parse the stored image URL list (https only, max 3). */
export function parseServiceImages(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((u): u is string => typeof u === "string" && /^https:\/\//i.test(u))
    .slice(0, 3);
}

export interface BookingSlot {
  ymd: string; // "2026-09-10" — the service's wall clock, never converted
  startMin: number;
  endMin: number;
}

/**
 * Every slot a request reserved, earliest first. Slot services store the
 * whole selection as JSON; the single-slot shape (eventDate + slotStartMin)
 * is read back as one half-hour slot so older rows still render.
 */
export function parseBookingSlots(request: {
  eventDate: Date | null;
  slotStartMin: number | null;
  slotSelections: unknown;
}): BookingSlot[] {
  const picks = Array.isArray(request.slotSelections) ? request.slotSelections : [];
  const out: BookingSlot[] = [];
  for (const row of picks.slice(0, 50)) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    if (typeof r.date !== "string" || typeof r.startMin !== "number") continue;
    out.push({
      ymd: r.date,
      startMin: r.startMin,
      endMin: typeof r.endMin === "number" ? r.endMin : r.startMin + 30,
    });
  }
  if (out.length > 0) {
    return out.sort((a, b) => a.ymd.localeCompare(b.ymd) || a.startMin - b.startMin);
  }
  if (request.eventDate && request.slotStartMin !== null) {
    return [
      {
        ymd: request.eventDate.toISOString().slice(0, 10),
        startMin: request.slotStartMin,
        endMin: request.slotStartMin + 30,
      },
    ];
  }
  return [];
}

/**
 * Where a booking begins: the one slot a session occupies, or the first of
 * a hire run. Null when the engagement has no agreed time yet.
 */
export function bookingSlot(request: {
  eventDate: Date | null;
  slotStartMin: number | null;
  slotSelections: unknown;
}): BookingSlot | null {
  return parseBookingSlots(request)[0] ?? null;
}

/** Base rate + selected extras — what the engagement is expected to cost. */
export function bookingTotalCents(input: {
  rateCents?: number | null;
  extras?: ServiceExtra[];
}): number | null {
  const extras = (input.extras ?? []).reduce((sum, e) => sum + (e.priceCents ?? 0), 0);
  if (input.rateCents === null || input.rateCents === undefined) {
    return extras > 0 ? extras : null;
  }
  return input.rateCents + extras;
}
