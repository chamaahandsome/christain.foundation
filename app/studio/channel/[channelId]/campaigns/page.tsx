import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";
import { daysLeft, progressPercent } from "@/lib/campaigns";

export const dynamic = "force-dynamic";
export const metadata = { title: "Campaigns" };

const BADGE: Record<string, string> = {
  DRAFT: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  LIVE: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  FUNDED: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  COMPLETED: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

// Campaign card grid (the Maltivas creator campaigns list).
export default async function CampaignsTab({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/signin");
  const { channelId } = await params;
  const access = await getChannelAccess(userId, channelId, FEATURES.CAMPAIGNS);
  if (!access.channel || !access.authorized) notFound();

  const canEdit =
    access.isOwner ||
    (access.featureAccess[FEATURES.CAMPAIGNS] ?? "none") === ACCESS_LEVELS.MANAGER;

  const campaigns = await db.campaign.findMany({
    where: { channelId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Campaigns</h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            Mission &amp; Creative crowdfunding — pledges pay you directly.
          </p>
        </div>
        {canEdit && (
          <Link
            href={`/studio/channel/${channelId}/campaigns/new`}
            className="rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500"
          >
            🚀 Start a campaign
          </Link>
        )}
      </div>

      {campaigns.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
          No campaigns yet. Raise support for a mission trip, a book, a film —
          backers pledge, the money goes straight to your account.
        </p>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => {
            const pct = progressPercent(c.raisedCents, c.goalCents);
            const left = daysLeft(c.endsAt);
            return (
              <Link
                key={c.id}
                href={`/studio/channel/${channelId}/campaigns/${c.id}`}
                className="group overflow-hidden rounded-2xl border border-neutral-200 transition-all hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md dark:border-neutral-800 dark:hover:border-amber-600"
              >
                <div className="relative aspect-video bg-neutral-100 dark:bg-neutral-800">
                  {c.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.coverImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-amber-100 to-orange-100 text-4xl dark:from-amber-950 dark:to-orange-950">
                      {c.category === "MISSION" ? "🌍" : "🎬"}
                    </div>
                  )}
                  <span
                    className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase ${BADGE[c.status]}`}
                  >
                    {c.status.toLowerCase()}
                  </span>
                </div>
                <div className="p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
                    {c.category === "MISSION" ? "Mission" : "Creative"}
                  </p>
                  <h3 className="mt-1 line-clamp-1 font-semibold group-hover:text-amber-700 dark:group-hover:text-amber-400">
                    {c.title}
                  </h3>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-amber-500 to-orange-600"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-neutral-500">
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">
                      ${(c.raisedCents / 100).toLocaleString()}
                      <span className="font-normal text-neutral-500">
                        {" "}
                        of ${(c.goalCents / 100).toLocaleString()}
                      </span>
                    </span>
                    <span>
                      {left !== null && c.status === "LIVE"
                        ? `${left}d left`
                        : `${c.backersCount} backers`}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
