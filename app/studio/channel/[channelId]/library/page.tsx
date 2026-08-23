import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";
import { IngestButton } from "@/components/IngestButton";
import { LibraryManager } from "@/components/LibraryManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Library" };

export default async function LibraryTab({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/signin");

  const { channelId } = await params;
  const access = await getChannelAccess(userId, channelId, FEATURES.LIBRARY);
  if (!access.channel || !access.authorized) notFound();

  const canEdit =
    access.isOwner ||
    (access.featureAccess[FEATURES.LIBRARY] ?? "none") === ACCESS_LEVELS.MANAGER;

  const [items, series] = await Promise.all([
    db.contentItem.findMany({
      where: { channelId },
      orderBy: { publishedAt: "desc" },
      take: 200,
      select: {
        id: true,
        title: true,
        visibility: true,
        seriesId: true,
        youtubeVideoId: true,
        publishedAt: true,
        durationSec: true,
        format: true,
      },
    }),
    db.series.findMany({
      where: { channelId },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { contentItems: true } } },
    }),
  ]);

  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-500">
          {items.length} items{items.length === 200 ? " (newest 200 shown)" : ""} ·
          Public items appear in the library; Members/Paid stay off the public
          surfaces until those tiers launch.
        </p>
        {canEdit &&
          (!access.channel.youtubeChannelId ? (
            <p className="text-xs text-neutral-500">
              Link a YouTube channel in Settings to import.
            </p>
          ) : !access.channel.youtubeVerifiedAt && !isAdmin(userId) ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Verify YouTube ownership in Settings to import.
            </p>
          ) : (
            <IngestButton channelId={channelId} />
          ))}
      </div>
      <LibraryManager
        channelId={channelId}
        canEdit={canEdit}
        initialItems={items.map((item) => ({
          ...item,
          publishedAt: item.publishedAt?.toISOString() ?? null,
        }))}
        initialSeries={series.map((s) => ({
          id: s.id,
          title: s.title,
          itemCount: s._count.contentItems,
        }))}
      />
    </section>
  );
}
