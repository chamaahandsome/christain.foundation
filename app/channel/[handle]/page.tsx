import Link from "next/link";
import { notFound } from "next/navigation";
import { Visibility } from "@prisma/client";
import { db } from "@/lib/db";
import { thumbnailUrl } from "@/lib/youtube";
import { BookCard } from "@/components/BookCard";
import { VideoRow } from "@/components/VideoRow";

export const dynamic = "force-dynamic";

// Stack icons: clean stroke SVGs (lucide-style), amber on the tile.
const STACK_ICONS: Record<string, React.ReactNode> = {
  play: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  ),
  videos: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <rect x="2" y="7" width="20" height="15" rx="2" />
      <path d="m17 2-5 5-5-5" />
    </svg>
  ),
  book: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  ),
  link: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  cup: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M12 2.69 6.34 8.34a8 8 0 1 0 11.32 0Z" />
    </svg>
  ),
};


// Home tab: the channel at a glance — latest teaching, Shorts, books.
// Featured products / campaigns / support join here as they land.
export default async function ChannelHomePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const channel = await db.channel.findUnique({
    where: { handle },
    select: {
      id: true,
      status: true,
      links: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
    },
  });
  if (!channel || channel.status !== "APPROVED") notFound();

  const [items, books] = await Promise.all([
    db.contentItem.findMany({
      where: {
        channelId: channel.id,
        visibility: Visibility.PUBLIC,
        unavailableAt: null,
        youtubeVideoId: { not: null },
      },
      orderBy: { publishedAt: "desc" },
      take: 36,
      select: { id: true, title: true, youtubeVideoId: true, format: true },
    }),
    db.ebook.findMany({
      where: { channelId: channel.id, published: true },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        title: true,
        author: true,
        coverImageUrl: true,
        priceCents: true,
      },
    }),
  ]);

  const latest = items.filter((i) => i.format === "STANDARD").slice(0, 12);
  const shorts = items.filter((i) => i.format === "SHORT").slice(0, 12);
  const videoCount = await db.contentItem.count({
    where: {
      channelId: channel.id,
      visibility: Visibility.PUBLIC,
      unavailableAt: null,
      youtubeVideoId: { not: null },
    },
  });
  const links = (channel.links as Record<string, string> | null) ?? {};

  if (items.length === 0 && books.length === 0) {
    return <p className="text-sm text-neutral-500">No content yet.</p>;
  }

  // Mobile: link-in-bio stack — full-width tappable rows. Shop, Campaigns,
  // and Support rows join this list as those features land.
  const stack: {
    href: string;
    icon: string;
    label: string;
    sub?: string;
    external?: boolean;
  }[] = [
    ...(latest[0]
      ? [{
          href: `/watch/${latest[0].id}`,
          icon: "play",
          label: "Latest teaching",
          sub: latest[0].title,
        }]
      : []),
    ...(videoCount > 0
      ? [{
          href: `/@${handle}/videos`,
          icon: "videos",
          label: "Videos",
          sub: `${videoCount} teachings, Shorts, and live streams`,
        }]
      : []),
    ...(books.length > 0
      ? [{
          href: `/@${handle}/books`,
          icon: "book",
          label: "Books",
          sub: books.map((b) => b.title).slice(0, 2).join(" · "),
        }]
      : []),
    ...(channel.stripeChargesEnabled && channel.stripePayoutsEnabled
      ? [{
          href: `/@${handle}/support`,
          icon: "cup",
          label: "Send a cup of cold water",
          sub: "Small support, straight to the ministry (Matt 10:42)",
        }]
      : []),
    ...Object.entries(links).map(([key, url]) => ({
      href: url,
      icon: "link",
      label: key.charAt(0).toUpperCase() + key.slice(1),
      external: true,
    })),
  ];

  return (
    <>
      {/* Mobile: the stack */}
      <div className="space-y-3 sm:hidden">
        {stack.map((row) => (
          <Link
            key={row.href}
            href={row.href}
            {...(row.external
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
            className="flex w-full items-center gap-4 rounded-2xl border border-neutral-200 p-4 shadow-sm transition-colors active:bg-amber-50 dark:border-neutral-800 dark:active:bg-amber-950/30"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">
              {STACK_ICONS[row.icon]}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{row.label}</span>
              {row.sub && (
                <span className="block truncate text-xs text-neutral-500">
                  {row.sub}
                </span>
              )}
            </span>
            <span aria-hidden className="text-neutral-400">
              →
            </span>
          </Link>
        ))}
      </div>

      {/* Desktop: rows and sliders */}
      <div className="hidden sm:block">
      {books.length > 0 && (
        <section className="mb-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Books
            </h2>
            <Link
              href={`/@${handle}/books`}
              className="text-sm text-amber-700 hover:underline dark:text-amber-400"
            >
              See all →
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none [&::-webkit-scrollbar]:hidden">
            {books.map((book) => (
              <BookCard key={book.id} book={book} className="w-32 shrink-0 sm:w-36" />
            ))}
          </div>
        </section>
      )}

      {latest.length > 0 && (
        <VideoRow title="Latest teaching" count={latest.length}>
          {latest.map((item) => (
            <Link
              key={item.id}
              href={`/watch/${item.id}`}
              className="group block w-44 shrink-0 snap-start sm:w-64"
            >
              {item.youtubeVideoId && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbnailUrl(item.youtubeVideoId, "mqdefault")}
                  alt=""
                  className="aspect-video w-full rounded-lg object-cover"
                />
              )}
              <p className="mt-2 line-clamp-2 text-sm group-hover:underline">
                {item.title}
              </p>
            </Link>
          ))}
        </VideoRow>
      )}

      {shorts.length > 0 && (
        <VideoRow title="Shorts" count={shorts.length}>
          {shorts.map((item) => (
            <Link
              key={item.id}
              href={`/watch/${item.id}`}
              className="group block w-32 shrink-0 snap-start sm:w-40"
            >
              {item.youtubeVideoId && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbnailUrl(item.youtubeVideoId, "mqdefault")}
                  alt=""
                  className="aspect-9/16 w-full rounded-lg object-cover"
                />
              )}
              <p className="mt-2 line-clamp-2 text-sm group-hover:underline">
                {item.title}
              </p>
            </Link>
          ))}
        </VideoRow>
      )}

      {items.length > 0 && (
        <p className="text-sm">
          <Link
            href={`/@${handle}/videos`}
            className="text-amber-700 hover:underline dark:text-amber-400"
          >
            All videos, live streams, and series →
          </Link>
        </p>
      )}
      </div>
    </>
  );
}
