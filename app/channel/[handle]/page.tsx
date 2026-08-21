import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Visibility } from "@prisma/client";
import { FollowButton } from "@/components/FollowButton";
import { db } from "@/lib/db";
import { thumbnailUrl } from "@/lib/youtube";

export const dynamic = "force-dynamic";

async function getChannel(handle: string) {
  return db.channel.findUnique({
    where: { handle },
    include: { _count: { select: { followers: true, contentItems: true } } },
  });
}

async function isFollowing(channelId: string): Promise<boolean> {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return false;
  const { userId } = await auth();
  if (!userId) return false;
  const follow = await db.follow.findUnique({
    where: { userId_channelId: { userId, channelId } },
    select: { userId: true },
  });
  return Boolean(follow);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const channel = await getChannel(handle).catch(() => null);
  if (!channel) return {};
  return { title: channel.name, description: channel.bio?.slice(0, 160) };
}

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const channel = await getChannel(handle).catch(() => null);
  if (!channel || channel.status !== "APPROVED") notFound();

  const [series, items] = await Promise.all([
    db.series.findMany({
      where: { channelId: channel.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, title: true, _count: { select: { contentItems: true } } },
    }),
    db.contentItem.findMany({
      where: {
        channelId: channel.id,
        visibility: Visibility.PUBLIC,
        youtubeVideoId: { not: null },
      },
      orderBy: { publishedAt: "desc" },
      take: 24,
      select: {
        id: true,
        title: true,
        youtubeVideoId: true,
        durationSec: true,
        publishedAt: true,
      },
    }),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">{channel.name}</h1>
            <p className="mt-1 text-sm text-neutral-500">
              @{channel.handle} · {channel._count.contentItems} items
            </p>
          </div>
          <FollowButton
            channelId={channel.id}
            initialFollowing={await isFollowing(channel.id)}
            initialFollowers={channel._count.followers}
          />
        </div>
        {channel.bio && (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            {channel.bio}
          </p>
        )}
        {channel.links != null && Object.keys(channel.links).length > 0 && (
          <p className="mt-3 flex flex-wrap gap-3 text-sm">
            {Object.entries(channel.links as Record<string, string>).map(
              ([key, url]) => (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="capitalize text-neutral-500 underline-offset-2 hover:text-amber-600 hover:underline"
                >
                  {key}
                </a>
              ),
            )}
          </p>
        )}
      </header>

      {series.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Series
          </h2>
          <div className="flex flex-wrap gap-2">
            {series.map((s) => (
              <span
                key={s.id}
                className="rounded-full border border-neutral-200 px-3 py-1 text-sm dark:border-neutral-700"
              >
                {s.title} ({s._count.contentItems})
              </span>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Latest
        </h2>
        {items.length === 0 ? (
          <p className="text-sm text-neutral-500">No content yet.</p>
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
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
