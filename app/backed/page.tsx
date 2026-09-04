import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { daysLeft, progressPercent } from "@/lib/campaigns";

export const dynamic = "force-dynamic";
export const metadata = { title: "Backed campaigns" };

// The supporter's view (the Maltivas backed-campaigns page): every campaign
// you've pledged to, with your pledge and its live progress.
export default async function BackedCampaignsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/signin");

  const pledges = await db.campaignPledge.findMany({
    where: { userId, status: { in: ["SUCCEEDED", "REFUNDED"] } },
    orderBy: { createdAt: "desc" },
    include: {
      campaign: {
        include: { channel: { select: { name: true, handle: true } } },
      },
      reward: { select: { title: true } },
    },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        Your support
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Backed campaigns</h1>
      <p className="mt-1 text-sm text-neutral-500">
        The work you&apos;ve stood behind, and how it&apos;s going.
      </p>

      {pledges.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
          <p className="text-4xl">🤝</p>
          <p className="mt-3 font-medium">You haven&apos;t backed anything yet</p>
          <Link
            href="/campaigns"
            className="mt-2 inline-block text-sm text-amber-700 hover:underline dark:text-amber-400"
          >
            Browse campaigns →
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {pledges.map((pl) => {
            const c = pl.campaign;
            const pct = progressPercent(c.raisedCents, c.goalCents);
            const left = daysLeft(c.endsAt);
            return (
              <Link
                key={pl.id}
                href={`/campaign/${c.slug}`}
                className="flex gap-4 rounded-2xl border border-neutral-200 p-4 transition-all hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md dark:border-neutral-800 dark:hover:border-amber-600"
              >
                <div className="hidden h-20 w-32 shrink-0 overflow-hidden rounded-xl bg-neutral-100 sm:block dark:bg-neutral-800">
                  {c.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.coverImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-amber-100 to-orange-100 text-2xl dark:from-amber-950 dark:to-orange-950">
                      {c.category === "MISSION" ? "🌍" : "🎬"}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate font-semibold">{c.title}</p>
                    <span className="shrink-0 text-xs uppercase text-neutral-400">
                      {c.status.toLowerCase()}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500">by {c.channel.name}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-amber-500 to-orange-600"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-xs text-neutral-500">
                    <span>
                      ${(c.raisedCents / 100).toLocaleString()} of $
                      {(c.goalCents / 100).toLocaleString()}
                      {left !== null && c.status === "LIVE" && ` · ${left}d left`}
                    </span>
                    <span
                      className={
                        pl.status === "REFUNDED"
                          ? "text-red-500"
                          : "font-medium text-neutral-700 dark:text-neutral-300"
                      }
                    >
                      {pl.status === "REFUNDED" ? "Refunded" : "You gave"} $
                      {(pl.amountCents / 100).toLocaleString()}
                      {pl.reward && ` · ${pl.reward.title}`}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
