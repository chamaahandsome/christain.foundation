import Link from "next/link";
import { Visibility } from "@prisma/client";
import { db } from "@/lib/db";
import { thumbnailUrl } from "@/lib/youtube";

export const dynamic = "force-dynamic";

// The front door. Featured creators/content render from the database as the
// platform fills; every section degrades gracefully while it's empty.

const CREATOR_TYPES = [
  {
    label: "Pastors & teachers",
    blurb: "Sermon archives, series by series — searchable by passage.",
    gradient: "from-amber-500/90 to-orange-600/90",
    icon: (
      <path d="M12 3v18M5 7c2.5-1.5 4.5-1.5 7 0 2.5-1.5 4.5-1.5 7 0M5 7v10c2.5-1.5 4.5-1.5 7 0 2.5-1.5 4.5-1.5 7 0V7" />
    ),
  },
  {
    label: "Apologists & debaters",
    blurb: "The hard questions, engaged at their strongest.",
    gradient: "from-sky-500/90 to-indigo-600/90",
    icon: (
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12ZM9 10h6M9 14h4" />
    ),
  },
  {
    label: "Missionaries",
    blurb: "Field updates and partnership from anywhere on earth.",
    gradient: "from-emerald-500/90 to-teal-600/90",
    icon: (
      <path d="M12 21c4.97 0 9-4.03 9-9s-4.03-9-9-9-9 4.03-9 9 4.03 9 9 9ZM3 12h18M12 3c2.5 2.6 4 5.7 4 9s-1.5 6.4-4 9c-2.5-2.6-4-5.7-4-9s1.5-6.4 4-9Z" />
    ),
  },
  {
    label: "Musicians & worship",
    blurb: "Albums, worship nights, and the songs of the church.",
    gradient: "from-fuchsia-500/90 to-purple-600/90",
    icon: <path d="M9 18V5l12-2v13M9 9l12-2M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm12-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />,
  },
  {
    label: "Filmmakers",
    blurb: "Stories of the faith, told seriously on screen.",
    gradient: "from-rose-500/90 to-red-600/90",
    icon: (
      <path d="M3 7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm13 3 5-3v10l-5-3" />
    ),
  },
  {
    label: "Authors & podcasters",
    blurb: "Books read on-platform; shows that go deeper.",
    gradient: "from-cyan-500/90 to-blue-600/90",
    icon: (
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 0 4 4.5v15ZM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
    ),
  },
];

const AVATAR_GRADIENTS = [
  "from-amber-500 to-orange-600",
  "from-sky-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-fuchsia-500 to-purple-600",
  "from-rose-500 to-red-600",
  "from-cyan-500 to-blue-600",
];

export default async function Home() {
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
          <p className="mx-auto mb-5 w-fit rounded-full border border-neutral-200 px-4 py-1 text-xs tracking-wide text-neutral-500 dark:border-neutral-800">
            For new believers, and the teachers who feed them
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-6xl">
            A home for sound teaching —{" "}
            <span className="bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">
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
              href="/start-here"
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
                    className={`flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br text-xl font-semibold text-white ${AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length]}`}
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

      {/* Who you'll find here */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-xl font-semibold">
          {channels.length > 0 ? "Who you'll find here" : "Who this is being built for"}
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Every creator here has affirmed the same statement of faith — vetted
          at the door so you don't have to triage.
        </p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CREATOR_TYPES.map((type) => (
            <li
              key={type.label}
              className="group relative overflow-hidden rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800"
            >
              <span
                className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white ${type.gradient}`}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  {type.icon}
                </svg>
              </span>
              <h3 className="font-medium">{type.label}</h3>
              <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                {type.blurb}
              </p>
            </li>
          ))}
        </ul>
      </section>

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
            href="/start-here"
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

      {/* Creator CTA */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="rounded-3xl bg-gradient-to-br from-neutral-900 to-neutral-700 p-10 text-center text-white dark:from-neutral-100 dark:to-neutral-300 dark:text-neutral-900">
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
