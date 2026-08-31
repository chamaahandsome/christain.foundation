import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Visibility } from "@prisma/client";
import { Comments } from "@/components/Comments";
import { MobileWatchPanels } from "@/components/MobileWatchPanels";
import { ReportTeachingButton } from "@/components/ReportTeachingButton";
import { YouTubeEmbed } from "@/components/YouTubeEmbed";
import { db } from "@/lib/db";
import { formatScriptureRef, type ScriptureRef } from "@/lib/scripture";
import { thumbnailUrl } from "@/lib/youtube";

export const dynamic = "force-dynamic";

async function getItem(id: string) {
  return db.contentItem.findUnique({
    where: { id },
    include: {
      channel: { select: { id: true, handle: true, name: true, status: true } },
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
  if (
    !item ||
    item.visibility !== Visibility.PUBLIC ||
    item.unavailableAt !== null ||
    item.channel.status !== "APPROVED" ||
    !item.youtubeVideoId
  ) {
    notFound();
  }

  let startSec: number | undefined;
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    const { userId } = await auth();
    if (userId) {
      const progress = await db.watchProgress.findUnique({
        where: { userId_contentItemId: { userId, contentItemId: item.id } },
      });
      if (progress && !progress.completedAt && progress.positionSec > 10) {
        startSec = progress.positionSec;
      }
    }
  }

  const related = await db.contentItem.findMany({
    where: {
      channelId: item.channelId,
      visibility: Visibility.PUBLIC,
      unavailableAt: null,
      id: { not: item.id },
      youtubeVideoId: { not: null },
    },
    orderBy: { publishedAt: "desc" },
    take: 8,
    select: { id: true, title: true, youtubeVideoId: true, durationSec: true },
  });

  const refs = (item.scriptureRefs as ScriptureRef[] | null) ?? [];

  const relatedList = (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        More from {item.channel.name}
      </h2>
      <ul className="space-y-3">
        {related.map((video) => (
          <li key={video.id}>
            <Link href={`/watch/${video.id}`} className="group flex gap-3">
              {video.youtubeVideoId && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbnailUrl(video.youtubeVideoId, "mqdefault")}
                  alt=""
                  className="h-16 w-28 shrink-0 rounded-md object-cover"
                />
              )}
              <span className="line-clamp-3 text-sm group-hover:underline">
                {video.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <main className="mx-auto max-w-6xl pb-8 lg:grid lg:grid-cols-[1fr_320px] lg:gap-8 lg:px-4 lg:py-8">
      <div>
        {/* Mobile: full-bleed player pinned under the site header — content
            scrolls beneath it, YouTube-app style. Desktop: in-flow. */}
        <div className="sticky top-14 z-30 bg-black lg:static lg:z-auto lg:rounded-none lg:bg-transparent">
          <YouTubeEmbed
            videoId={item.youtubeVideoId}
            contentItemId={item.id}
            startSec={startSec}
            title={item.title}
          />
        </div>
        <div className="px-4 lg:px-0">
        <h1 className="mt-4 text-2xl font-semibold">{item.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-neutral-500">
          <Link
            href={`/@${item.channel.handle}`}
            className="font-medium text-neutral-800 hover:underline dark:text-neutral-200"
          >
            {item.channel.name}
          </Link>
          {item.series && <span>· {item.series.title}</span>}
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
            related={relatedList}
            comments={<Comments contentItemId={item.id} />}
          />
        </div>

        {/* Desktop: comments inline under the description */}
        <div className="hidden lg:block">
          <Comments contentItemId={item.id} />
        </div>
        </div>
      </div>

      <aside className="hidden lg:block">{relatedList}</aside>
    </main>
  );
}
