import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics" };

// Creator analytics v1 (PLAN §8): what the embedded pipeline can already
// answer. Revenue and lapse-risk signals arrive with the commerce phases.
export default async function AnalyticsTab({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/signin");

  const { channelId } = await params;
  const access = await getChannelAccess(userId, channelId, FEATURES.ANALYTICS);
  if (!access.channel || !access.authorized) notFound();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [followers, newFollowers, itemCount, watches, completions, likes, comments, topWatched] =
    await Promise.all([
      db.follow.count({ where: { channelId } }),
      db.follow.count({ where: { channelId, createdAt: { gte: thirtyDaysAgo } } }),
      db.contentItem.count({ where: { channelId } }),
      db.watchProgress.count({ where: { contentItem: { channelId } } }),
      db.watchProgress.count({
        where: { contentItem: { channelId }, completedAt: { not: null } },
      }),
      db.like.count({ where: { contentItem: { channelId } } }),
      db.comment.count({ where: { contentItem: { channelId }, status: "APPROVED" } }),
      db.watchProgress.groupBy({
        by: ["contentItemId"],
        where: { contentItem: { channelId } },
        _count: { contentItemId: true },
        orderBy: { _count: { contentItemId: "desc" } },
        take: 10,
      }),
    ]);

  const topItems =
    topWatched.length > 0
      ? await db.contentItem.findMany({
          where: { id: { in: topWatched.map((t) => t.contentItemId) } },
          select: { id: true, title: true },
        })
      : [];
  const titleById = new Map(topItems.map((item) => [item.id, item.title]));

  const stats: { label: string; value: string }[] = [
    { label: "Followers", value: String(followers) },
    { label: "New followers (30d)", value: `+${newFollowers}` },
    { label: "Library items", value: String(itemCount) },
    { label: "Watches started", value: String(watches) },
    { label: "Watches completed", value: String(completions) },
    {
      label: "Completion rate",
      value: watches > 0 ? `${Math.round((completions / watches) * 100)}%` : "—",
    },
    { label: "Likes", value: String(likes) },
    { label: "Comments", value: String(comments) },
  ];

  return (
    <section className="mt-6">
      <p className="text-sm text-neutral-500">
        Embedded-playback metrics. Signed-in viewers only — public embeds
        without accounts don't report progress, so treat these as a floor.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <p className="text-2xl font-semibold">{stat.value}</p>
            <p className="mt-1 text-xs text-neutral-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-medium">Most-watched teaching</h2>
        {topWatched.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No watch data yet.</p>
        ) : (
          <ol className="mt-3 space-y-2">
            {topWatched.map((row, i) => (
              <li key={row.contentItemId} className="flex items-baseline gap-3 text-sm">
                <span className="w-5 shrink-0 text-right font-semibold text-amber-600">
                  {i + 1}
                </span>
                <Link
                  href={`/watch/${row.contentItemId}`}
                  className="min-w-0 flex-1 truncate hover:underline"
                >
                  {titleById.get(row.contentItemId) ?? row.contentItemId}
                </Link>
                <span className="shrink-0 text-neutral-500">
                  {row._count.contentItemId} watches
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
