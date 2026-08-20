import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hasFeatureAccess, FEATURES, ACCESS_LEVELS } from "@/lib/team";
import { getAccessibleChannels } from "@/lib/team-authorization";
import { AppealButton } from "@/components/AppealButton";
import { IngestButton } from "@/components/IngestButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Studio" };

// Creator dashboard: channels you own, plus channels you help manage as team
// staff (PLAN §4). Unapproved visitors are pointed at the application.
export default async function StudioPage() {
  const { userId } = await auth();
  if (!userId) redirect("/signin");

  const [{ owned: channels, managing }, application] = await Promise.all([
    getAccessibleChannels(userId),
    db.creatorApplication.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  // Standing audit (§5.4): cases on the owner's channels, decided or in
  // flight. Upheld decisions carry an appeal affordance.
  const reviewCases =
    channels.length > 0
      ? await db.doctrineReviewCase.findMany({
          where: { channelId: { in: channels.map((c) => c.id) } },
          orderBy: { updatedAt: "desc" },
          include: {
            channel: { select: { name: true, handle: true } },
            contentItem: { select: { id: true, title: true } },
          },
        })
      : [];

  if (channels.length === 0 && managing.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
          Creator studio
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Studio</h1>
        {application ? (
          <div className="mt-6 rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
            <p className="font-medium">
              Application status:{" "}
              <span className="uppercase">{application.status.replace("_", " ")}</span>
            </p>
            {application.status === "REJECTED" && application.decisionNote && (
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                {application.decisionNote}
              </p>
            )}
            {(application.status === "DRAFT" || application.status === "REJECTED") && (
              <Link href="/apply" className="mt-4 inline-block text-sm underline">
                Continue your application
              </Link>
            )}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              You don't have a channel yet.
            </p>
            <Link href="/apply" className="mt-3 inline-block text-sm underline">
              Apply to become a creator
            </Link>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        Creator studio
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Studio</h1>
      <div className="mt-6 space-y-4">
        {channels.map((channel) => (
          <section
            key={channel.id}
            className="rounded-xl border border-neutral-200 p-6 dark:border-neutral-800"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium">{channel.name}</h2>
                <p className="text-sm text-neutral-500">
                  <Link href={`/@${channel.handle}`} className="hover:underline">
                    @{channel.handle}
                  </Link>{" "}
                  · {channel.status} · {channel._count.contentItems} items ·{" "}
                  {channel._count.followers} followers
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href={`/studio/team/${channel.id}`}
                  className="text-sm underline"
                >
                  Team
                </Link>
                {channel.youtubeChannelId ? (
                  <IngestButton channelId={channel.id} />
                ) : (
                  <p className="text-xs text-neutral-500">
                    No YouTube channel linked.
                  </p>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>

      {reviewCases.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-medium">Doctrine review</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Review runs on published teaching (§5.4). Outcomes are never
            noteless, and upheld decisions can be appealed.
          </p>
          <ul className="mt-4 space-y-4">
            {reviewCases.map((reviewCase) => (
              <li
                key={reviewCase.id}
                className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm">
                    <span className="font-medium">@{reviewCase.channel.handle}</span>
                    {reviewCase.contentItem && (
                      <>
                        {" · "}
                        <Link
                          href={`/watch/${reviewCase.contentItem.id}`}
                          className="underline"
                        >
                          {reviewCase.contentItem.title}
                        </Link>
                      </>
                    )}{" "}
                    <span className="ml-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium uppercase text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                      {reviewCase.status.replace("_", " ")}
                    </span>
                  </p>
                  {reviewCase.status === "UPHELD" && (
                    <AppealButton caseId={reviewCase.id} />
                  )}
                </div>
                {reviewCase.outcomeNote && (
                  <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                    {reviewCase.outcomeNote}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {managing.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-medium">Channels you help manage</h2>
          <div className="mt-4 space-y-4">
            {managing.map(({ channel, featureAccess }) => (
              <section
                key={channel.id}
                className="rounded-xl border border-neutral-200 p-6 dark:border-neutral-800"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-medium">{channel.name}</h3>
                    <p className="text-sm text-neutral-500">
                      <Link href={`/@${channel.handle}`} className="hover:underline">
                        @{channel.handle}
                      </Link>{" "}
                      · {channel._count.contentItems} items ·{" "}
                      {channel._count.followers} followers
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {hasFeatureAccess(featureAccess, FEATURES.TEAM) && (
                      <Link
                        href={`/studio/team/${channel.id}`}
                        className="text-sm underline"
                      >
                        Team
                      </Link>
                    )}
                    {hasFeatureAccess(
                      featureAccess,
                      FEATURES.LIBRARY,
                      ACCESS_LEVELS.MANAGER,
                    ) &&
                      channel.youtubeChannelId && (
                        <IngestButton channelId={channel.id} />
                      )}
                  </div>
                </div>
              </section>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
