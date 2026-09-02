import Link from "next/link";
import { db } from "@/lib/db";
import { daysLeft, progressPercent } from "@/lib/campaigns";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Campaigns",
  description: "Back missions and creative work — pledges go straight to the creator.",
};

// Public campaign browse: live campaigns from approved channels.
export default async function CampaignsPage() {
  const campaigns = await db.campaign.findMany({
    where: { status: { in: ["LIVE", "FUNDED"] }, channel: { status: "APPROVED" } },
    orderBy: [{ status: "asc" }, { publishedAt: "desc" }],
    include: { channel: { select: { name: true, handle: true } } },
    take: 60,
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        Crowdfunding
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Campaigns</h1>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
        Missions to stand behind and creative work to bring into being. Every
        pledge goes straight to the creator — nothing is held along the way.
      </p>

      {campaigns.length === 0 ? (
        <p className="mt-10 rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
          No campaigns are live right now. Check back soon.
        </p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => {
            const pct = progressPercent(c.raisedCents, c.goalCents);
            const left = daysLeft(c.endsAt);
            return (
              <Link
                key={c.id}
                href={`/campaign/${c.slug}`}
                className="group overflow-hidden rounded-2xl border border-neutral-200 transition-colors hover:border-amber-400 dark:border-neutral-800 dark:hover:border-amber-600"
              >
                <div className="aspect-video bg-neutral-100 dark:bg-neutral-800">
                  {c.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.coverImageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
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
                  </p>
                  <h2 className="mt-1 line-clamp-2 font-semibold group-hover:text-amber-700 dark:group-hover:text-amber-400">
                    {c.title}
                  </h2>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    by {c.channel.name}
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
                      {left !== null ? `${left}d left` : `${c.backersCount} backers`}
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
