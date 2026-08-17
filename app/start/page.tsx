import Link from "next/link";
import {
  formatDurationCoarse,
  isPlaceholderVideo,
  startHereTopics,
} from "@/lib/start-here";

export const metadata = {
  title: "Start Here",
  description:
    "Fifteen questions every new believer asks, in the order worth asking them — answered with the clearest teaching we could find.",
};

// Card art priority: curator cover_image → first curated video thumbnail →
// mono tile with a ghosted number. Palette is monochrome with the brand's
// amber→orange accent (hero CTA, number chips, hover borders).

export default function StartPage() {
  const topics = startHereTopics();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-neutral-950 px-6 py-14 text-center text-white sm:px-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_100%_at_50%_0%,rgba(245,158,11,0.16),transparent_70%)]"
        />
        <p className="relative mx-auto w-fit rounded-full border border-white/20 px-4 py-1 text-xs tracking-wide text-neutral-300">
          Fifteen questions · in the order worth asking them
        </p>
        <h1 className="relative mt-5 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Where do I start?
        </h1>
        <p className="relative mx-auto mt-4 max-w-xl text-pretty text-sm leading-7 text-neutral-300">
          You just came to faith — or you're close. These are the questions
          every new believer asks, answered with the clearest teaching we
          could find. Take them at your pace; each one hands you the next.
        </p>
        <Link
          href={`/start/${topics[0].slug}`}
          className="group relative mt-8 inline-flex items-center gap-2 rounded-2xl bg-linear-to-r from-amber-500 to-orange-600 px-7 py-3.5 text-base font-semibold text-white shadow-lg hover:from-amber-400 hover:to-orange-500"
        >
          Begin with question 1
          <span aria-hidden className="transition-transform group-hover:translate-x-1">
            →
          </span>
        </Link>
      </div>

      {/* The pathway grid */}
      <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {topics.map((topic) => {
          const curated = topic.videos.filter((v) => !isPlaceholderVideo(v));
          const cover =
            topic.cover_image ??
            (curated[0]
              ? `https://i.ytimg.com/vi/${curated[0].youtube_id}/hqdefault.jpg`
              : null);
          const totalSec = curated.reduce((sum, v) => sum + v.duration_seconds, 0);
          const open = topic.tier === "open_question";

          return (
            <li key={topic.slug}>
              <Link
                href={`/start/${topic.slug}`}
                className="group block overflow-hidden rounded-2xl border border-neutral-200 transition-colors hover:border-amber-500/70 dark:border-neutral-800 dark:hover:border-amber-500/60"
              >
                {/* Card art */}
                <div className="relative aspect-[5/3] w-full overflow-hidden bg-neutral-950">
                  {cover ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={cover}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover opacity-90 transition-transform duration-300 group-hover:scale-105"
                      />
                      <span className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/75 via-black/20 to-transparent" />
                    </>
                  ) : (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -right-3 -top-9 select-none text-[9rem] font-bold leading-none text-white/10"
                    >
                      {topic.order}
                    </span>
                  )}

                  {/* Number chip */}
                  <span className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-orange-600/90 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur">
                    {topic.order}
                  </span>

                  {open && (
                    <span className="absolute right-3 top-3 rounded-full border border-white/30 bg-black/40 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
                      Open question
                    </span>
                  )}

                  {/* Label strip over the art */}
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
                    <span className="block text-xs font-medium uppercase tracking-widest text-white/60">
                      {topic.label}
                    </span>
                  </span>
                </div>

                {/* Card body */}
                <div className="p-4">
                  <h2 className="text-base font-semibold leading-snug group-hover:underline">
                    {topic.question}
                  </h2>
                  <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                    {topic.framing}
                  </p>
                  <p className="mt-2 text-xs text-neutral-400">
                    {curated.length > 0
                      ? `${curated.length} videos${totalSec > 0 ? ` · ${formatDurationCoarse(totalSec)}` : ""}`
                      : "Teaching being hand-picked"}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
