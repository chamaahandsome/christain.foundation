import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Visibility } from "@prisma/client";
import { db } from "@/lib/db";
import { thumbnailUrl } from "@/lib/youtube";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your feed" };

// The core loop: follow creators → their latest fills your feed.
export default async function FeedPage() {
  const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const { userId } = hasClerk ? await auth() : { userId: null };

  if (!userId) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Your feed</h1>
        <p className="mt-3 text-sm text-neutral-500">
          Sign in and follow creators — their latest teaching lands here.
        </p>
        <Link href="/explore" className="mt-4 inline-block text-sm underline">
          Explore the library
        </Link>
      </main>
    );
  }

  const items = await db.contentItem.findMany({
    where: {
      visibility: Visibility.PUBLIC,
      unavailableAt: null,
      youtubeVideoId: { not: null },
      channel: {
        status: "APPROVED",
        followers: { some: { userId } },
      },
    },
    orderBy: { publishedAt: "desc" },
    take: 48,
    select: {
      id: true,
      title: true,
      youtubeVideoId: true,
      publishedAt: true,
      channel: { select: { name: true, handle: true } },
    },
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        Following
      </p>
      <h1 className="mb-6 mt-2 text-2xl font-semibold">Your feed</h1>
      {items.length === 0 ? (
        <div className="rounded-xl border border-neutral-200 p-8 text-center dark:border-neutral-800">
          <p className="text-sm text-neutral-500">
            Nothing here yet — follow some creators and their teaching will
            land in your feed.
          </p>
          <Link href="/explore" className="mt-3 inline-block text-sm underline">
            Explore the library
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
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
    </main>
  );
}
