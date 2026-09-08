// The public service cards (the Maltivas ServiceCatalog, CF-skinned): a
// photo header with the category floating over it, then the title, what's
// available, the price pill, what's included, and a Book now button that
// leads to that service's own booking page.

import Link from "next/link";

export interface CatalogService {
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
}

export function ServiceCatalog({
  handle,
  services,
}: {
  handle: string;
  services: CatalogService[];
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {services.map((s) => (
        <div
          key={s.id}
          className="group overflow-hidden rounded-2xl border border-neutral-200 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-neutral-800"
        >
          <div className="relative h-48 w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800">
            {s.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.images[0]}
                alt=""
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-linear-to-br from-amber-100 to-orange-100 text-4xl opacity-40 dark:from-amber-950 dark:to-orange-950">
                📅
              </span>
            )}
            <div className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent" />
            <span className="absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
              {s.category}
            </span>
          </div>

          <div className="space-y-4 p-6">
            <div>
              <h3 className="text-xl font-extrabold leading-tight">{s.title}</h3>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                {s.description}
              </p>
            </div>

            <p className="text-xs text-neutral-500">
              <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                Available:
              </span>{" "}
              {s.availableDays.length > 0
                ? s.availableDays.join(", ")
                : "Any day, by arrangement"}
              {s.slotMinutes
                ? ` · ${s.slotMinutes}-minute slots`
                : s.durationMins
                  ? ` · about ${s.durationMins} min`
                  : ""}
            </p>

            <p className="flex w-fit items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              {s.rateCents !== null && !s.privateRate ? (
                <>
                  From ${(s.rateCents / 100).toLocaleString()}
                  <span className="font-medium opacity-70">/{s.rateUnit}</span>
                </>
              ) : (
                "Price on request"
              )}
            </p>

            {(s.requirements || s.extras.length > 0) && (
              <div className="border-t border-neutral-100 pt-3 dark:border-neutral-800">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  {s.requirements ? "Host provides" : "Add-ons"}
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500">
                  {s.requirements ?? s.extras.map((x) => x.name).join(", ")}
                </p>
              </div>
            )}

            <Link
              href={`/@${handle}/book/${s.id}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:from-amber-400 hover:to-orange-500"
            >
              <CalendarIcon />
              Book now
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="h-4 w-4"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
