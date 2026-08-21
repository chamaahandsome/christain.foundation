import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";
import { LibraryManager } from "@/components/LibraryManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Library" };

// Library management — titles, visibility, series. Team staff with
// library:viewer can look; edits require library:manager (enforced by the
// API; the UI disables controls for viewers).
export default async function StudioLibraryPage({
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
      },
    }),
    db.series.findMany({
      where: { channelId },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { contentItems: true } } },
    }),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        Creator studio
      </p>
      <h1 className="mt-2 text-2xl font-semibold">
        Library — {access.channel.name}
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        {items.length} items{items.length === 200 ? " (newest 200 shown)" : ""} ·
        Public items appear in the library; Members/Paid stay off the public
        surfaces until those tiers launch.
      </p>
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
    </main>
  );
}
