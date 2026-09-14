import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminNav } from "@/components/AdminNav";
import { isAdminUser } from "@/lib/admin";
import type { FunnelStep, ItemPlays, StartHereSummary } from "@/lib/start-here-analytics";
import { ANALYTICS_WINDOWS, loadStartHereAnalytics } from "@/lib/start-here-analytics-db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Start Here analytics" };

type AnalyticsWindow = (typeof ANALYTICS_WINDOWS)[number];

const pct = (share: number | null) => (share === null ? "—" : `${Math.round(share * 100)}%`);

const figure = (n: number) =>
  new Intl.NumberFormat("en", {
    notation: n >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(n);

const KIND_LABEL: Record<ItemPlays["kind"], string> = {
  video: "Video",
  series: "Series",
  debate: "Debate",
};

// Who uses Start Here, how far they get, and what they press play on. Every
// number comes from the pure definitions in lib/start-here-analytics, over
// first-party anonymous events (lib/start-here-analytics-db).
export default async function AdminStartHerePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  if (!(await isAdminUser())) notFound();

  const { days: requested } = await searchParams;
  const days: AnalyticsWindow = (ANALYTICS_WINDOWS as readonly number[]).includes(Number(requested))
    ? (Number(requested) as AnalyticsWindow)
    : 30;

  let data: Awaited<ReturnType<typeof loadStartHereAnalytics>> | null = null;
  try {
    data = await loadStartHereAnalytics(days);
  } catch (err) {
    console.error("admin start-here analytics: load failed", err);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
        Admin
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Start Here analytics</h1>
      <p className="mt-1 max-w-2xl text-sm text-neutral-500">
        How many people use the pathway, how far they get, and what they press
        play on. Visitors are anonymous — a random id per browser, with no
        names or emails — and browsers that ask not to be tracked aren&apos;t
        counted.
      </p>
      <AdminNav current="/admin/start-here" />

      {/* One row of filters, above everything it scopes. */}
      <nav aria-label="Date range" className="mt-6 flex flex-wrap items-center gap-2">
        {ANALYTICS_WINDOWS.map((window) => {
          const active = window === days;
          return (
            <Link
              key={window}
              href={`/admin/start-here?days=${window}`}
              aria-current={active ? "true" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "border-neutral-900 font-semibold text-neutral-900 dark:border-neutral-100 dark:text-neutral-100"
                  : "border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900"
              }`}
            >
              {active && (
                <span aria-hidden className="font-bold">
                  ✓
                </span>
              )}
              Last {window} days
            </Link>
          );
        })}
      </nav>

      {!data ? (
        <p className="mt-8 rounded-2xl border border-dashed border-neutral-300 p-6 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
          Analytics aren&apos;t available — the events table may not exist yet.
          Run <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">npx prisma db push</code>{" "}
          and reload.
        </p>
      ) : data.summary.visitors === 0 && data.summary.plays === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-neutral-300 p-6 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
          No one has used Start Here in the last {days} days yet. Numbers appear
          here as soon as someone opens a step.
        </p>
      ) : (
        <>
          <StatTiles summary={data.summary} />
          <Funnel funnel={data.funnel} days={days} />
          <Plays items={data.items} />
        </>
      )}
    </main>
  );
}

function StatTiles({ summary }: { summary: StartHereSummary }) {
  const signedInShare = summary.visitors > 0 ? summary.signedInVisitors / summary.visitors : null;
  const tiles = [
    { label: "Visitors", value: figure(summary.visitors), note: "opened at least one step" },
    { label: "Signed in", value: figure(summary.signedInVisitors), note: `${pct(signedInShare)} of visitors` },
    {
      label: "Reached the last step",
      value: figure(summary.reachedFinalStep),
      note: `${pct(summary.completionRate)} of visitors`,
    },
    {
      label: "Plays",
      value: figure(summary.plays),
      note: `${figure(summary.playingVisitors)} ${summary.playingVisitors === 1 ? "visitor" : "visitors"} pressed play`,
    },
  ];
  return (
    <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
        >
          <dt className="text-xs text-neutral-500">{tile.label}</dt>
          <dd className="mt-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
            {tile.value}
          </dd>
          <dd className="mt-0.5 text-xs text-neutral-500">{tile.note}</dd>
        </div>
      ))}
    </dl>
  );
}

function Funnel({ funnel, days }: { funnel: FunnelStep[]; days: number }) {
  const max = Math.max(1, ...funnel.map((step) => step.visitors));
  return (
    <section aria-labelledby="funnel-heading" className="mt-10">
      <h2 id="funnel-heading" className="text-lg font-semibold">
        How far people get
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-neutral-500">
        Distinct visitors who reached each step in the last {days} days. Someone
        who arrives by a link to a later step counts there too, so a later step
        can outnumber step 1.
      </p>

      <ol className="mt-4 space-y-1.5">
        {funnel.map((step) => {
          // Bars scale to 85% of the track so the value always fits past the tip.
          const width = (step.visitors / max) * 85;
          const detail = `Step ${step.order}, ${step.label}: ${step.visitors} visitors, ${pct(step.ofFirst)} of step 1, ${pct(step.fromPrevious)} of the step before`;
          return (
            <li
              key={step.slug}
              tabIndex={0}
              aria-label={detail}
              className="group relative grid grid-cols-[9.5rem_minmax(0,1fr)] items-center gap-3 rounded-md px-1 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-amber-500 sm:grid-cols-[13rem_minmax(0,1fr)]"
            >
              <span className="truncate text-sm text-neutral-700 dark:text-neutral-300">
                <span className="tabular-nums text-neutral-400">{step.order}.</span> {step.label}
              </span>
              <span
                aria-hidden
                className="flex h-5 min-w-0 items-center border-l border-neutral-300 dark:border-neutral-700"
              >
                {step.visitors > 0 && (
                  <span
                    className="h-full rounded-r-[4px] bg-amber-500 transition-opacity group-hover:opacity-75 group-focus-visible:opacity-75 dark:bg-amber-400"
                    style={{ width: `${width}%` }}
                  />
                )}
                <span className="ml-2 shrink-0 text-sm tabular-nums text-neutral-900 dark:text-neutral-100">
                  {step.visitors.toLocaleString()}
                </span>
              </span>
              <span
                role="tooltip"
                className="pointer-events-none absolute left-40 top-full z-10 mt-1 hidden w-max max-w-xs rounded-lg bg-neutral-900 px-3 py-2 text-xs text-neutral-200 shadow-lg group-hover:block group-focus-visible:block sm:left-56 dark:bg-neutral-100 dark:text-neutral-700"
              >
                <span className="block text-sm font-semibold tabular-nums text-white dark:text-neutral-900">
                  {step.visitors.toLocaleString()} {step.visitors === 1 ? "visitor" : "visitors"}
                </span>
                <span className="block">
                  {step.label} · {pct(step.ofFirst)} of step 1 · {pct(step.fromPrevious)} of the step before
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
          Show as a table
        </summary>
        <div className="mt-3 overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500 dark:bg-neutral-900">
              <tr>
                <th className="px-3 py-2 font-medium">Step</th>
                <th className="px-3 py-2 text-right font-medium">Visitors</th>
                <th className="px-3 py-2 text-right font-medium">Of step 1</th>
                <th className="px-3 py-2 text-right font-medium">Of the step before</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {funnel.map((step) => (
                <tr key={step.slug}>
                  <td className="px-3 py-2">
                    <span className="tabular-nums text-neutral-400">{step.order}.</span> {step.label}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{step.visitors.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pct(step.ofFirst)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pct(step.fromPrevious)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

function Plays({ items }: { items: ItemPlays[] }) {
  const played = items.filter((item) => item.plays > 0);
  const unplayed = items.filter((item) => item.plays === 0);
  return (
    <section aria-labelledby="plays-heading" className="mt-12">
      <h2 id="plays-heading" className="text-lg font-semibold">
        What people press play on
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        A series counts once when it starts, not once for each part.
      </p>

      {played.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">Nothing has been played in this window yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500 dark:bg-neutral-900">
              <tr>
                <th className="px-3 py-2 font-medium">Teaching</th>
                <th className="px-3 py-2 font-medium">Step</th>
                <th className="px-3 py-2 text-right font-medium">Plays</th>
                <th className="px-3 py-2 text-right font-medium">Viewers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {played.slice(0, 25).map((item) => (
                <tr key={`${item.stepSlug}-${item.kind}-${item.key}`}>
                  <td className="px-3 py-2">
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">{item.title}</span>
                    <span className="block text-xs text-neutral-500">
                      {KIND_LABEL[item.kind]} · {item.creator}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-neutral-600 dark:text-neutral-400">
                    <span className="tabular-nums">{item.stepOrder}.</span> {item.stepLabel}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{item.plays.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{item.visitors.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {unplayed.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-medium text-neutral-800 dark:text-neutral-200">
            Not played yet ({unplayed.length})
          </summary>
          <p className="mt-2 text-xs text-neutral-500">
            Worth a look when curating: nobody pressed play on these in this window.
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {unplayed.map((item) => (
              <li key={`${item.stepSlug}-${item.kind}-${item.key}`} className="flex flex-wrap gap-x-2">
                <span className="tabular-nums text-neutral-400">{item.stepOrder}.</span>
                <span className="text-neutral-800 dark:text-neutral-200">{item.title}</span>
                <span className="text-neutral-500">
                  — {KIND_LABEL[item.kind]}, {item.creator}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
