import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics" };

// Creator analytics: embedded-playback metrics for everyone with analytics
// access, plus commerce/giving/campaign performance. Revenue figures are
// owner-only, matching the Payments tab.
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

  const [txByType, giftGivers, publishedBooks, bookSales, freeSales, campaigns, tricklForwarded] =
    await Promise.all([
      db.transaction.groupBy({
        by: ["type"],
        where: { channelId, status: "SUCCEEDED" },
        _sum: { amountCents: true, feeCents: true },
        _count: { _all: true },
      }),
      db.transaction.groupBy({
        by: ["userId"],
        where: { channelId, status: "SUCCEEDED", type: "GIFT" },
      }),
      db.ebook.count({ where: { channelId, published: true } }),
      db.ebookPurchase.count({ where: { ebook: { channelId } } }),
      db.ebookPurchase.count({ where: { ebook: { channelId }, provider: "free" } }),
      db.campaign.findMany({
        where: { channelId, status: { not: "DRAFT" } },
        orderBy: [{ status: "asc" }, { publishedAt: "desc" }],
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          goalCents: true,
          raisedCents: true,
          backersCount: true,
        },
      }),
      db.tricklChunk.aggregate({
        where: { channelId, status: "FORWARDED" },
        _sum: { netCents: true },
      }),
    ]);

  // Whole-dollar amounts drop the cents — $1,875 reads better than $1,875.00.
  const money = (cents: number) =>
    `$${(cents / 100).toLocaleString(undefined, {
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;
  const byType = new Map(txByType.map((r) => [r.type, r]));
  const sumOf = (type: string) => byType.get(type as never)?._sum.amountCents ?? 0;
  const feeOf = (type: string) => byType.get(type as never)?._sum.feeCents ?? 0;
  const countOf = (type: string) => byType.get(type as never)?._count._all ?? 0;
  const grossCents = sumOf("PURCHASE") + sumOf("GIFT") + sumOf("PLEDGE") + sumOf("TICKET");
  const feesCents = feeOf("PURCHASE") + feeOf("GIFT") + feeOf("PLEDGE") + feeOf("TICKET");
  const netCents = grossCents - feesCents;

  const topItems =
    topWatched.length > 0
      ? await db.contentItem.findMany({
          where: { id: { in: topWatched.map((t) => t.contentItemId) } },
          select: { id: true, title: true },
        })
      : [];
  const titleById = new Map(topItems.map((item) => [item.id, item.title]));

  const audience = [
    { label: "Followers", value: String(followers), sub: `+${newFollowers} this month` },
    { label: "Watches started", value: String(watches), sub: `${completions} completed` },
    {
      label: "Completion rate",
      value: watches > 0 ? `${Math.round((completions / watches) * 100)}%` : "—",
      sub: "signed-in viewers",
    },
    {
      label: "Engagement",
      value: String(likes + comments),
      sub: `${likes} likes · ${comments} comments`,
    },
  ];

  const revenueRows = [
    { label: "Book sales", cents: sumOf("PURCHASE") - feeOf("PURCHASE"), count: countOf("PURCHASE") },
    { label: "Cups of cold water", cents: sumOf("GIFT") - feeOf("GIFT"), count: countOf("GIFT") },
    { label: "Campaign pledges", cents: sumOf("PLEDGE") - feeOf("PLEDGE"), count: countOf("PLEDGE") },
  ].filter((r) => r.count > 0);

  return (
    <section className="mt-6 space-y-12">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Audience
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {audience.map((stat) => (
            <div key={stat.label}>
              <p className="text-3xl font-semibold tracking-tight">{stat.value}</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                {stat.label}
              </p>
              <p className="text-xs text-neutral-400 dark:text-neutral-500">{stat.sub}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-neutral-400 dark:text-neutral-500">
          {itemCount} library items · playback counts only signed-in viewers, so
          treat them as a floor.
        </p>
      </div>

      {access.isOwner && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Revenue
          </h2>
          <div className="mt-4 flex flex-col gap-8 rounded-2xl border border-neutral-200 p-6 sm:flex-row sm:items-start dark:border-neutral-800">
            <div className="shrink-0">
              <p className="text-4xl font-semibold tracking-tight">{money(netCents)}</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                Net to you, all time
              </p>
              <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
                {money(grossCents)} gross · after the platform fee
              </p>
            </div>
            <div className="min-w-0 flex-1 sm:border-l sm:border-neutral-100 sm:pl-8 dark:sm:border-neutral-800">
              {revenueRows.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  No payments yet — revenue appears here as books sell, cups
                  arrive, and pledges land.
                </p>
              ) : (
                <dl className="space-y-2">
                  {revenueRows.map((r) => (
                    <div key={r.label} className="flex items-baseline justify-between gap-3 text-sm">
                      <dt className="text-neutral-600 dark:text-neutral-400">
                        {r.label}
                        <span className="ml-1.5 text-xs text-neutral-400">×{r.count}</span>
                      </dt>
                      <dd className="font-medium">{money(r.cents)}</dd>
                    </div>
                  ))}
                  {(tricklForwarded._sum.netCents ?? 0) > 0 && (
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <dt className="text-neutral-600 dark:text-neutral-400">of which via Trickl</dt>
                      <dd className="font-medium">{money(tricklForwarded._sum.netCents ?? 0)}</dd>
                    </div>
                  )}
                  {giftGivers.length > 0 && (
                    <p className="pt-1 text-xs text-neutral-400 dark:text-neutral-500">
                      {giftGivers.length} distinct gift supporter{giftGivers.length === 1 ? "" : "s"}
                    </p>
                  )}
                </dl>
              )}
            </div>
          </div>
          <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
            Stripe's own processing fees settle in your Stripe dashboard.
          </p>
        </div>
      )}

      {publishedBooks > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Books
          </h2>
          <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">
            <span className="text-2xl font-semibold tracking-tight">{bookSales}</span>{" "}
            {bookSales === 1 ? "copy" : "copies"} in readers&apos; libraries
            <span className="ml-2 text-xs text-neutral-400 dark:text-neutral-500">
              {publishedBooks} published · {bookSales - freeSales} paid ·{" "}
              {freeSales} free
            </span>
          </p>
        </div>
      )}

      {campaigns.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Campaigns
          </h2>
          <ol className="mt-4 space-y-4">
            {campaigns.map((c) => {
              const pct = Math.min(
                100,
                Math.floor((c.raisedCents / c.goalCents) * 100),
              );
              return (
                <li key={c.id} className="text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link
                      href={`/campaign/${c.slug}`}
                      className="min-w-0 flex-1 truncate font-medium hover:underline"
                    >
                      {c.title}
                      {c.status !== "LIVE" && (
                        <span className="ml-2 text-xs font-normal uppercase text-neutral-400">
                          {c.status.toLowerCase()}
                        </span>
                      )}
                    </Link>
                    <span className="shrink-0 text-neutral-500">
                      {money(c.raisedCents)}{" "}
                      <span className="text-neutral-400">of {money(c.goalCents)}</span> ·{" "}
                      {c.backersCount} backer{c.backersCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-amber-500 to-orange-600"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Most-watched teaching
        </h2>
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
