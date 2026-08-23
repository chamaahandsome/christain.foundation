import Link from "next/link";
import { searchAll } from "@/lib/search";
import { thumbnailUrl } from "@/lib/youtube";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search" };

// Site-wide search: the doctrinal map first (questions are the product core),
// then channels, series, and the teaching library (FULLTEXT + fallback,
// lib/search.ts).
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const results = query
    ? await searchAll(query).catch(() => null)
    : { questions: [], channels: [], series: [], items: [] };

  const total = results
    ? results.questions.length +
      results.channels.length +
      results.series.length +
      results.items.length
    : 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        Search
      </p>
      <form action="/search" className="mb-8 mt-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          autoFocus
          placeholder="Search topics, questions, teachers, teaching…"
          className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-base outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-amber-600"
        />
      </form>

      {query && !results && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Search is unavailable right now — try again in a moment.
        </p>
      )}

      {query && results && total === 0 && (
        <div className="rounded-xl border border-neutral-200 p-6 text-center dark:border-neutral-800">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Nothing found for “{query}”.
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Try a broader word — or start from{" "}
            <Link href="/map" className="underline">
              the map
            </Link>{" "}
            or{" "}
            <Link href="/start" className="underline">
              Start Here
            </Link>
            .
          </p>
        </div>
      )}

      {results && results.questions.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            From the map
          </h2>
          <ul className="space-y-3">
            {results.questions.map((question) => (
              <li key={question.slug}>
                <Link
                  href={`/map/${question.slug}`}
                  className="group block rounded-xl border border-neutral-200 p-4 transition-colors hover:border-amber-500/70 dark:border-neutral-800 dark:hover:border-amber-500/60"
                >
                  <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
                    {question.tier === "SPINE"
                      ? "The spine — essential"
                      : "Disputed among the faithful"}
                  </p>
                  <p className="mt-1 font-medium group-hover:underline">
                    {question.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-400">
                    {question.framing}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results && results.channels.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Channels
          </h2>
          <ul className="flex flex-wrap gap-3">
            {results.channels.map((channel) => (
              <li key={channel.handle}>
                <Link
                  href={`/@${channel.handle}`}
                  className="block rounded-xl border border-neutral-200 px-4 py-3 transition-colors hover:border-amber-500/70 dark:border-neutral-800 dark:hover:border-amber-500/60"
                >
                  <p className="font-medium">{channel.name}</p>
                  <p className="text-sm text-neutral-500">
                    @{channel.handle} · {channel.kind.toLowerCase()} ·{" "}
                    {channel.followers} followers
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results && results.series.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Series
          </h2>
          <ul className="flex flex-wrap gap-3">
            {results.series.map((series) => (
              <li key={series.id}>
                <Link
                  href={`/@${series.channel.handle}`}
                  className="block rounded-xl border border-neutral-200 px-4 py-3 transition-colors hover:border-amber-500/70 dark:border-neutral-800 dark:hover:border-amber-500/60"
                >
                  <p className="font-medium">{series.title}</p>
                  <p className="text-sm text-neutral-500">
                    {series.channel.name} · {series.itemCount} videos
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results && results.items.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Teaching
            <span className="ml-2 font-normal normal-case tracking-normal text-neutral-400">
              {results.items.length}
            </span>
          </h2>
          <ul className="space-y-4">
            {results.items.map((item) => (
              <li key={item.id}>
                <Link href={`/watch/${item.id}`} className="group flex gap-4">
                  {item.youtubeVideoId && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbnailUrl(item.youtubeVideoId, "mqdefault")}
                      alt=""
                      className="h-20 w-36 shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <div>
                    <p className="line-clamp-2 font-medium group-hover:underline">
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm text-neutral-500">
                      {item.channel.name}
                      {item.format === "SHORT" && " · Short"}
                      {item.format === "LIVE" && " · Live stream"}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
