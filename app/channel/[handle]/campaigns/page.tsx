import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { daysLeft, progressPercent } from "@/lib/campaigns";

export const dynamic = "force-dynamic";
export const metadata = { title: "Campaigns" };

// The channel's crowdfunding shelf — live and funded campaigns.
export default async function ChannelCampaignsPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const channel = await db.channel.findUnique({
    where: { handle },
    select: { id: true, name: true, status: true },
  });
  if (!channel || channel.status !== "APPROVED") notFound();

  const campaigns = await db.campaign.findMany({
    where: { channelId: channel.id, status: { in: ["LIVE", "FUNDED", "COMPLETED"] } },
    orderBy: [{ status: "asc" }, { publishedAt: "desc" }],
  });

  if (campaigns.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        {channel.name} has no campaigns right now.
      </p>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {campaigns.map((c) => {
        const pct = progressPercent(c.raisedCents, c.goalCents);
        const left = daysLeft(c.endsAt);
        const done = c.status === "COMPLETED";
        return (
          <Link
            key={c.id}
            href={`/campaign/${c.slug}`}
            className={`group overflow-hidden rounded-2xl border border-neutral-200 transition-colors hover:border-amber-400 dark:border-neutral-800 dark:hover:border-amber-600 ${
              done ? "opacity-70" : ""
            }`}
          >
            <div className="aspect-video bg-neutral-100 dark:bg-neutral-800">
              {c.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.coverImageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-amber-100 to-orange-100 text-4xl dark:from-amber-950 dark:to-orange-950">
                  {c.category === "MISSION" ? "🌍" : "🎬"}
                </div>
              )}
            </div>
            <div className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
                {c.category === "MISSION" ? "Mission" : "Creative"}
                {c.status === "FUNDED" && " · funded"}
                {done && " · ended"}
              </p>
              <h2 className="mt-1 line-clamp-2 font-semibold group-hover:text-amber-700 dark:group-hover:text-amber-400">
                {c.title}
              </h2>
              <p className="mt-1 line-clamp-2 text-sm text-neutral-500">
                {c.shortDescription}
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                <div
                  className="h-full rounded-full bg-linear-to-r from-amber-500 to-orange-600"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-2 flex items-baseline justify-between text-xs">
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                  ${(c.raisedCents / 100).toLocaleString()}
                  <span className="font-normal text-neutral-500">
                    {" "}
                    of ${(c.goalCents / 100).toLocaleString()}
                  </span>
                </span>
                <span className="text-neutral-500">
                  {!done && left !== null ? `${left}d left` : `${c.backersCount} backers`}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
