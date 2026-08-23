import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Visibility } from "@prisma/client";
import { FollowButton } from "@/components/FollowButton";
import { VideoRow } from "@/components/VideoRow";
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

  const itemSelect = {
    id: true,
    title: true,
    youtubeVideoId: true,
    durationSec: true,
    publishedAt: true,
    format: true,
    seriesId: true,
  } as const;

  const [seriesRows, items] = await Promise.all([
    db.series.findMany({
      where: { channelId: channel.id, contentItems: { some: {} } },
      orderBy: { sortOrder: "asc" },
      take: 15,
      select: { id: true, title: true, _count: { select: { contentItems: true } } },
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

  // Per-series shelf content (a video can appear in Latest and its series).
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

  // Shelved the way the channel looks on YouTube: Latest, Shorts, Lives,
  // then one slider per playlist-mirrored (or hand-made) series with content.
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

      {shelves.length === 0 ? (
        <p className="text-sm text-neutral-500">No content yet.</p>
      ) : (
        shelves.map((shelf) => (
          <VideoRow key={shelf.key} title={shelf.title} count={shelf.items.length}>
            {shelf.items.map((item) => (
              <Link
                key={item.id}
                href={`/watch/${item.id}`}
                className={`group block shrink-0 snap-start ${
                  shelf.short ? "w-32 sm:w-40" : "w-56 sm:w-64"
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
        ))
      )}
    </main>
  );
}
