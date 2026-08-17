import Link from "next/link";
import { Visibility } from "@prisma/client";
import { db } from "@/lib/db";
import { thumbnailUrl } from "@/lib/youtube";

export const dynamic = "force-dynamic";
export const metadata = { title: "Explore" };

export default async function ExplorePage() {
  const [shelves, latest] = await Promise.all([
    db.shelf
      .findMany({
        where: { published: true },
        orderBy: { sortOrder: "asc" },
        include: {
          items: {
            orderBy: { sortOrder: "asc" },
            take: 12,
            include: {
              contentItem: {
                select: {
                  id: true,
                  title: true,
                  youtubeVideoId: true,
                  channel: { select: { name: true, handle: true } },
                },
              },
            },
          },
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
        take: 24,
        select: {
          id: true,
          title: true,
          youtubeVideoId: true,
          channel: { select: { name: true, handle: true } },
        },
      })
      .catch(() => []),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        The library
      </p>
      <h1 className="mb-6 mt-2 text-2xl font-semibold">Explore</h1>

      {shelves.map((shelf) => {
        const items = shelf.items.filter((i) => i.contentItem);
        if (items.length === 0) return null;
        return (
          <section key={shelf.id} className="mb-10">
            <h2 className="mb-3 text-lg font-medium">{shelf.title}</h2>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {items.map(({ contentItem }) => (
                <li key={contentItem!.id}>
                  <Link href={`/watch/${contentItem!.id}`} className="group block">
                    {contentItem!.youtubeVideoId && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbnailUrl(contentItem!.youtubeVideoId, "mqdefault")}
                        alt=""
                        className="aspect-video w-full rounded-lg object-cover"
                      />
                    )}
                    <p className="mt-2 line-clamp-2 text-sm group-hover:underline">
                      {contentItem!.title}
                    </p>
                    <p className="text-xs text-neutral-500">
                      {contentItem!.channel.name}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section>
        <h2 className="mb-3 text-lg font-medium">Latest</h2>
        {latest.length === 0 ? (
          <p className="text-sm text-neutral-500">
            The library is being assembled. Check back soon.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {latest.map((item) => (
              <li key={item.id}>
                <Link href={`/watch/${item.id}`} className="group block">
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
                  <p className="text-xs text-neutral-500">{item.channel.name}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
