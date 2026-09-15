import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Comments } from "@/components/Comments";
import { FollowButton } from "@/components/FollowButton";
import { MobileWatchPanels } from "@/components/MobileWatchPanels";
import { PinnedPlayer } from "@/components/PinnedPlayer";
import { ReportTeachingButton } from "@/components/ReportTeachingButton";
import { WatchRail } from "@/components/WatchRail";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";
import { db } from "@/lib/db";
import { formatScriptureRef, type ScriptureRef } from "@/lib/scripture";
import { SERIES_ORDER, seriesUpNext } from "@/lib/series-order";
import {
  RAIL_ORDER,
  RAIL_PAGE_SIZE,
  RAIL_SELECT,
  pageWithCursor,
  railWhere,
  type RailSeries,
} from "@/lib/watch-rail";
import { thumbnailUrl } from "@/lib/youtube";

// ISR (SCALABILITY §3.1): a watch page renders identically for everyone and
// is CDN-cached (continue-watching resumes client-side in YouTubeEmbed).
// Embedded YouTube is free to watch signed in or not, so nothing here reads
// the viewer — the whole route stays static. Follow state and later rail
// pages are fetched by the client, for the same reason.
export const revalidate = 300;

async function getItem(id: string) {
  return db.contentItem.findUnique({
    where: { id },
    include: {
      channel: {
        select: {
          id: true,
          handle: true,
          name: true,
          status: true,
          ownerId: true,
          avatarUrl: true,
          _count: { select: { followers: true } },
        },
      },
      series: { select: { id: true, title: true } },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const item = await getItem(id).catch(() => null);
  if (!item) return {};
  return {
    title: item.title,
    description: item.description?.slice(0, 160),
    openGraph: {
      title: item.title,
      description: item.description?.slice(0, 200),
      images: item.youtubeVideoId ? [thumbnailUrl(item.youtubeVideoId)] : [],
    },
  };
}

export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await getItem(id).catch(() => null);
  // Embedded YouTube is free: anyone may watch, signed in or not. The
  // youtubeVideoId requirement is what keeps this page to embeds — native
  // and text content will arrive with a gate of its own, and `visibility`
  // is waiting for it.
  if (
    !item ||
    item.unavailableAt !== null ||
    item.channel.status !== "APPROVED" ||
    !item.youtubeVideoId
  ) {
    notFound();
  }

  // A video in a series leads on to the series' next parts, in the
  // creator's order. The channel list follows without repeating them.
  const seriesItems = item.series
    ? await db.contentItem.findMany({
        where: {
          seriesId: item.series.id,
          unavailableAt: null,
          youtubeVideoId: { not: null },
        },
        orderBy: SERIES_ORDER,
        take: 1000,
        select: RAIL_SELECT,
      })
    : [];
  const upNext = seriesUpNext(seriesItems, item.id);
  const series: RailSeries | null =
    item.series && upNext.total > 1 ? { title: item.series.title, ...upNext } : null;
  const excludeIds = [item.id, ...(series?.next.map((video) => video.id) ?? [])];

  // The rail's first page; WatchRail fetches the rest as the viewer scrolls.
  const rail = pageWithCursor(
    await db.contentItem.findMany({
      where: railWhere(item.channelId, excludeIds),
      orderBy: RAIL_ORDER,
      take: RAIL_PAGE_SIZE + 1,
      select: RAIL_SELECT,
    }),
    RAIL_PAGE_SIZE,
  );

  const refs = (item.scriptureRefs as ScriptureRef[] | null) ?? [];

  const railProps = {
    channelId: item.channel.id,
    channelName: item.channel.name,
    excludeIds,
    series,
    initialItems: rail.items,
    initialCursor: rail.nextCursor,
  };

  return (
    <main className="mx-auto max-w-6xl pb-8 lg:grid lg:grid-cols-[1fr_320px] lg:gap-8 lg:px-4 lg:py-8">
      <div>
        {/* Below the desktop layout (lg): player pinned under the site
            header — the page scrolls beneath it, YouTube-app style. The
            video is centered and width-capped; PinnedPlayer measures the
            real bar height so nothing ever hides behind it. */}
        <PinnedPlayer>
          <YouTubeEmbed
            videoId={item.youtubeVideoId}
            contentItemId={item.id}
            title={item.title}
          />
        </PinnedPlayer>
        <div className="px-4 lg:px-0">
        <Link
          href={`/@${item.channel.handle}`}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-amber-700 hover:underline lg:hidden dark:text-amber-400"
        >
          <span aria-hidden>←</span> Back to @{item.channel.handle}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold lg:mt-4">{item.title}</h1>

        {/* Who taught it, and the way to keep up with them — YouTube's
            channel row under the title. */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/@${item.channel.handle}`}
            className="group flex min-w-0 items-center gap-3"
          >
            {item.channel.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.channel.avatarUrl}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-amber-500 to-orange-600 font-semibold text-white">
                {item.channel.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate font-semibold text-neutral-900 group-hover:underline dark:text-neutral-100">
                {item.channel.name}
              </span>
              {item.series && (
                <span className="block truncate text-xs text-neutral-500">
                  {item.series.title}
                </span>
              )}
            </span>
          </Link>
          <FollowButton
            channelId={item.channel.id}
            initialFollowers={item.channel._count.followers}
          />
        </div>

        {refs.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {refs.map((ref, i) => (
              <span
                key={i}
                className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
              >
                {formatScriptureRef(ref)}
              </span>
            ))}
          </div>
        )}
        {item.description && (
          <p className="mt-4 whitespace-pre-line text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            {item.description}
          </p>
        )}
        <ReportTeachingButton contentItemId={item.id} />

        {/* Mobile: comments swap in over the videos list, YT-app style */}
        <div className="lg:hidden">
          <MobileWatchPanels
            related={<WatchRail key={item.id} {...railProps} />}
            comments={<Comments contentItemId={item.id} />}
          />
        </div>

        {/* Desktop: comments inline under the description */}
        <div className="hidden lg:block">
          <Comments contentItemId={item.id} />
        </div>
        </div>
      </div>

      {/* Desktop: the rail holds its place under the header and scrolls on
          its own, so the viewer can browse the channel with the player
          still in view. */}
      <aside className="hidden lg:sticky lg:top-22 lg:flex lg:max-h-[calc(100dvh-7.5rem)] lg:flex-col lg:self-start">
        <WatchRail key={item.id} {...railProps} scroll />
      </aside>
    </main>
  );
}
