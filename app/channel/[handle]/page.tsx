import Link from "next/link";
import { notFound } from "next/navigation";
import { Visibility } from "@prisma/client";
import { db } from "@/lib/db";
import { thumbnailUrl } from "@/lib/youtube";
import { BookCard } from "@/components/BookCard";
import { VideoRow } from "@/components/VideoRow";

export const dynamic = "force-dynamic";

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
    select: { id: true, status: true },
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

  if (items.length === 0 && books.length === 0) {
    return <p className="text-sm text-neutral-500">No content yet.</p>;
  }

  return (
    <>
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
    </>
  );
}
