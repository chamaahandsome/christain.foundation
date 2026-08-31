import Link from "next/link";
import { notFound } from "next/navigation";
import { Visibility } from "@prisma/client";
import { db } from "@/lib/db";
import { thumbnailUrl } from "@/lib/youtube";
import { VideoRow } from "@/components/VideoRow";

export const dynamic = "force-dynamic";

// Videos tab: the full library, shelved the way the channel looks on
// YouTube — Latest, Shorts, Lives, then one slider per populated series.
export default async function ChannelVideosPage({
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

  const itemSelect = {
    id: true,
    title: true,
    youtubeVideoId: true,
    format: true,
    seriesId: true,
  } as const;

  const [seriesRows, items] = await Promise.all([
    db.series.findMany({
      where: { channelId: channel.id, contentItems: { some: {} } },
      orderBy: { sortOrder: "asc" },
      take: 15,
      select: { id: true, title: true },
    }),
    db.contentItem.findMany({
      where: {
        channelId: channel.id,
        visibility: Visibility.PUBLIC,
        unavailableAt: null,
        youtubeVideoId: { not: null },
      },
      orderBy: { publishedAt: "desc" },
      take: 60,
      select: itemSelect,
    }),
  ]);

  const seriesItems =
    seriesRows.length > 0
      ? await db.contentItem.findMany({
          where: {
            channelId: channel.id,
            visibility: Visibility.PUBLIC,
            unavailableAt: null,
            youtubeVideoId: { not: null },
            seriesId: { in: seriesRows.map((s) => s.id) },
          },
          orderBy: { publishedAt: "desc" },
          take: 200,
          select: itemSelect,
        })
      : [];

  type Item = (typeof items)[number];

  const shelves: { key: string; title: string; items: Item[]; short?: boolean }[] = [
    { key: "latest", title: "Latest", items: items.filter((i) => i.format === "STANDARD").slice(0, 24) },
    { key: "shorts", title: "Shorts", items: items.filter((i) => i.format === "SHORT").slice(0, 24), short: true },
    { key: "live", title: "Live streams", items: items.filter((i) => i.format === "LIVE").slice(0, 24) },
    ...seriesRows.map((s) => ({
      key: s.id,
      title: s.title,
      items: seriesItems.filter((i) => i.seriesId === s.id).slice(0, 24),
    })),
  ].filter((shelf) => shelf.items.length > 0);

  if (shelves.length === 0) {
    return <p className="text-sm text-neutral-500">No videos yet.</p>;
  }

  return (
    <>
      {shelves.map((shelf) => (
        <VideoRow key={shelf.key} title={shelf.title} count={shelf.items.length}>
          {shelf.items.map((item) => (
            <Link
              key={item.id}
              href={`/watch/${item.id}`}
              className={`group block shrink-0 snap-start ${
                shelf.short ? "w-32 sm:w-40" : "w-44 sm:w-64"
              }`}
            >
              {item.youtubeVideoId && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbnailUrl(item.youtubeVideoId, "mqdefault")}
                  alt=""
                  className={`w-full rounded-lg object-cover ${
                    shelf.short ? "aspect-9/16" : "aspect-video"
                  }`}
                />
              )}
              <p className="mt-2 line-clamp-2 text-sm group-hover:underline">
                {item.title}
              </p>
            </Link>
          ))}
        </VideoRow>
      ))}
    </>
  );
}
