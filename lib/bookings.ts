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
