import Link from "next/link";
import { Visibility } from "@prisma/client";
import { VideoMarquee, type MarqueeItem } from "@/components/VideoMarquee";
import { db } from "@/lib/db";
import { thumbnailUrl } from "@/lib/youtube";
import showcase from "@/lib/showcase.json";

export const dynamic = "force-dynamic";

// The front door. Featured creators/content render from the database as the
// platform fills; every section degrades gracefully while it's empty.

const AVATAR_GRADIENTS = [
  "from-amber-500 to-orange-600",
  "from-sky-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-fuchsia-500 to-purple-600",
  "from-rose-500 to-red-600",
  "from-cyan-500 to-blue-600",
];

export default async function Home() {
  // Marquee: the platform's own library once it has enough items; until
  // then, a generated showcase of real videos from well-known channels
  // (lib/showcase.json — dev placeholder, links go to YouTube).
  const libraryItems = await db.contentItem
    .findMany({
      where: {
        visibility: Visibility.PUBLIC,
        youtubeVideoId: { not: null },
        channel: { status: "APPROVED" },
      },
      orderBy: { publishedAt: "desc" },
      take: 24,
      select: {
        id: true,
        title: true,
        youtubeVideoId: true,
        channel: { select: { name: true } },
      },
    })
    .catch(() => []);

  const marqueeItems: MarqueeItem[] =
    libraryItems.length >= 8
      ? libraryItems.map((item) => ({
          videoId: item.youtubeVideoId!,
          title: item.title,
          channel: item.channel.name,
          href: `/watch/${item.id}`,
        }))
      : // Showcase fallback: display only, deliberately unlinked — the
        // marquee never sends people off the site.
        (showcase as { videoId: string; title: string; channel: string }[]);

  const [channels, latest] = await Promise.all([
    db.channel
      .findMany({
        where: { status: "APPROVED" },
        orderBy: { followers: { _count: "desc" } },
        take: 6,
        select: {
          id: true,
          handle: true,
          name: true,
          kind: true,
          _count: { select: { followers: true, contentItems: true } },
        },
      })
      .catch(() => []),
    db.contentItem
      .findMany({
        where: {
          visibility: Visibility.PUBLIC,
          youtubeVideoId: { not: null },
          channel: { status: "APPROVED" },
        },
        orderBy: { publishedAt: "desc" },
        take: 8,
        select: {
          id: true,
          title: true,
          youtubeVideoId: true,
          channel: { select: { name: true } },
        },
      })
      .catch(() => []),
  ]);

  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(245,158,11,0.12),transparent_70%)]"
        />
        <div className="mx-auto max-w-4xl px-4 pb-16 pt-20 text-center sm:pt-28">
          <p className="mx-auto mb-5 w-fit rounded-full border border-neutral-200 px-4 py-1.5 text-[11px] uppercase tracking-[0.18em] text-neutral-500 sm:text-xs dark:border-neutral-800">
            In essentials, <span className="font-bold text-neutral-800 dark:text-neutral-200">unity</span> · In non-essentials, liberty · In all things, charity
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            A home for sound teaching —{" "}
            <span className="bg-linear-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
              and for the people who teach it.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-7 text-neutral-600 dark:text-neutral-400">
            You just came to faith and you're asking,{" "}
            <em>"where do I start?"</em> Start here: the essentials laid out
            clearly, the disputed questions mapped honestly, and the teachers,
            musicians, and missionaries of the church — in one place.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/start"
              className="rounded-xl bg-neutral-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
            >
              Start Here
            </Link>
            <Link
              href="/explore"
              className="rounded-xl border border-neutral-300 px-6 py-3 text-sm font-semibold hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Explore the library
            </Link>
          </div>
        </div>

        {/* The moving shop window — teaching scrolling by */}
        <div className="pb-16">
          <VideoMarquee items={marqueeItems} />
        </div>
      </section>

      {/* Featured creators — real once the platform fills */}
      {channels.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="mb-6 text-xl font-semibold">On the platform</h2>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {channels.map((channel, i) => (
              <li key={channel.id}>
                <Link
                  href={`/@${channel.handle}`}
                  className="group flex flex-col items-center gap-3 rounded-2xl border border-neutral-200 p-5 text-center hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
                >
                  <span
                    className={`flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br text-xl font-semibold text-white ${AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length]}`}
                  >
                    {channel.name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((word) => word[0]?.toUpperCase())
                      .join("")}
                  </span>
                  <span>
                    <span className="block text-sm font-medium group-hover:underline">
                      {channel.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-neutral-500">
                      {channel.kind.charAt(0) + channel.kind.slice(1).toLowerCase()} ·{" "}
                      {channel._count.contentItems} items
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Latest from the library */}
      {latest.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-12">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Fresh from the library</h2>
            <Link href="/explore" className="text-sm underline">
              See all
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {latest.map((item) => (
              <li key={item.id}>
                <Link href={`/watch/${item.id}`} className="group block">
                  {item.youtubeVideoId && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbnailUrl(item.youtubeVideoId, "mqdefault")}
                      alt=""
                      className="aspect-video w-full rounded-xl object-cover"
                    />
                  )}
                  <p className="mt-2 line-clamp-2 text-sm group-hover:underline">
                    {item.title}
                  </p>
                  <p className="text-xs text-neutral-500">{item.channel.name}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* The map, explained */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-4 lg:grid-cols-3">
          <Link
            href="/start"
            className="group rounded-2xl border border-neutral-200 p-8 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
              Step one
            </p>
            <h3 className="mt-2 text-lg font-semibold group-hover:underline">
              Start Here
            </h3>
            <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              A guided path through the essentials: who Jesus is, what the
              gospel is, why the resurrection changes everything.
            </p>
          </Link>
          <Link
            href="/map"
            className="group rounded-2xl border border-neutral-200 p-8 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
              The spine
            </p>
            <h3 className="mt-2 text-lg font-semibold group-hover:underline">
              Certainty where there is certainty
            </h3>
            <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              On the essentials you'll find one confident answer — no
              "perspectives," no both-sides framing.
            </p>
          </Link>
          <Link
            href="/map"
            className="group rounded-2xl border border-neutral-200 p-8 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
              The map
            </p>
            <h3 className="mt-2 text-lg font-semibold group-hover:underline">
              Honesty where the faithful disagree
            </h3>
            <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              Baptism, end times, spiritual gifts — the strongest case for
              each view, side by side, and what's actually at stake.
            </p>
          </Link>
        </div>
      </section>

      {/* What we stand for */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-xl font-semibold">What we stand for</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Said plainly, so you know exactly where this platform stands.
        </p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          <li className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
            <h3 className="font-semibold">We affirm the Nicene Creed</h3>
            <p className="mt-1.5 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              In its plain, historic sense: one God in three persons; Jesus
              Christ true God and true man, crucified, bodily raised,
              returning to judge.
            </p>
          </li>
          <li className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
            <h3 className="font-semibold">Scripture is the final authority</h3>
            <p className="mt-1.5 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              In all matters of faith and practice — and salvation is by grace
              alone, through faith alone, in Christ alone.
            </p>
          </li>
          <li className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
            <h3 className="font-semibold">Certainty on the essentials</h3>
            <p className="mt-1.5 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              Where Christians cannot disagree, you'll find one confident
              answer — no "perspectives," no both-sides framing.
            </p>
          </li>
          <li className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
            <h3 className="font-semibold">Honest liberty on the rest</h3>
            <p className="mt-1.5 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              Baptism, end times, spiritual gifts — where the faithful
              disagree, we show each view at its strongest and say what's
              actually at stake.
            </p>
          </li>
        </ul>
        <p className="mt-4 text-sm text-neutral-500">
          Every teacher here has affirmed this — vetted by what they affirm,
          not what label they wear.{" "}
          <Link href="/map" className="underline hover:text-neutral-800 dark:hover:text-neutral-200">
            See the map of what's settled and what's open →
          </Link>
        </p>
      </section>

      {/* Creator CTA */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="rounded-3xl bg-linear-to-br from-neutral-900 to-neutral-700 p-10 text-center text-white dark:from-neutral-100 dark:to-neutral-300 dark:text-neutral-900">
          <h2 className="text-2xl font-semibold">Do you teach, sing, or serve?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 opacity-80">
            Keep your YouTube — bring your people home. Your library, your
            audience, and everything that sustains the work, in one place you
            actually own.
          </p>
          <Link
            href="/apply"
            className="mt-6 inline-block rounded-xl bg-white px-6 py-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-200 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-700"
          >
            Apply to become a creator
          </Link>
        </div>
      </section>

      {/* Tagline footer */}
      <footer className="border-t border-neutral-200 py-12 text-center dark:border-neutral-800">
        <p className="text-sm uppercase tracking-widest text-neutral-500">
          In essentials, <span className="font-bold">unity</span>. In
          non-essentials, liberty. In all things, charity.
        </p>
        <p className="mt-2 text-xs text-neutral-400">— Rupertus Meldenius</p>
      </footer>
    </main>
  );
}
