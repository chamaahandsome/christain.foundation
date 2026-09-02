import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { affirmationComplete } from "@/lib/gate";
import { ChannelTabs, type ChannelTab } from "@/components/ChannelTabs";
import { FollowButton } from "@/components/FollowButton";
import { StatementBadge } from "@/components/StatementBadge";

export const dynamic = "force-dynamic";

// The creator's public home (/@handle): one header, tabbed content below.
// Tabs appear as the channel grows — Videos, Books today; Shop, Campaigns,
// and Support join as commerce, crowdfunding, and giving land.

async function getChannel(handle: string) {
  return db.channel.findUnique({
    where: { handle },
    include: { _count: { select: { followers: true, contentItems: true } } },
  });
}

async function isFollowing(channelId: string): Promise<boolean> {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return false;
  const { userId } = await auth();
  if (!userId) return false;
  const follow = await db.follow.findUnique({
    where: { userId_channelId: { userId, channelId } },
    select: { userId: true },
  });
  return Boolean(follow);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const channel = await getChannel(handle).catch(() => null);
  if (!channel) return {};
  return { title: channel.name, description: channel.bio?.slice(0, 160) };
}

export default async function ChannelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const channel = await getChannel(handle).catch(() => null);
  if (!channel || channel.status !== "APPROVED") notFound();

  const [bookCount, campaignCount] = await Promise.all([
    db.ebook.count({ where: { channelId: channel.id, published: true } }),
    db.campaign.count({
      where: { channelId: channel.id, status: { in: ["LIVE", "FUNDED"] } },
    }),
  ]);

  const canReceiveGifts =
    channel.stripeChargesEnabled && channel.stripePayoutsEnabled;
  const tabs: ChannelTab[] = [
    { slug: "", label: "Home" },
    ...(channel._count.contentItems > 0 ? [{ slug: "videos", label: "Videos" }] : []),
    ...(bookCount > 0 ? [{ slug: "books", label: "Books" }] : []),
    ...(campaignCount > 0 ? [{ slug: "campaigns", label: "Campaigns" }] : []),
    ...(canReceiveGifts ? [{ slug: "support", label: "Support" }] : []),
    // Coming as the features land: { slug: "shop" }
  ];

  // The visible signature (§5): show the statement badge only when the
  // owner has affirmed the current published statement in full.
  let affirmedStatement: {
    version: number;
    title: string;
    preamble: string;
    clauses: { key: string; title: string; text: string }[];
    affirmedOn: string;
  } | null = null;
  const statement = await db.statementVersion.findFirst({
    where: { publishedAt: { not: null } },
    orderBy: { version: "desc" },
    include: { clauses: { orderBy: { sortOrder: "asc" } } },
  });
  if (statement) {
    const affirmations = await db.affirmationRecord.findMany({
      where: { userId: channel.ownerId, statementVersionId: statement.id },
      select: { affirmedAt: true, clause: { select: { key: true } } },
    });
    const check = affirmationComplete(
      statement.clauses.map((c) => c.key),
      affirmations.map((a) => a.clause.key),
    );
    if (check.complete && affirmations.length > 0) {
      const latest = affirmations.reduce((max, a) =>
        a.affirmedAt > max.affirmedAt ? a : max,
      );
      affirmedStatement = {
        version: statement.version,
        title: statement.title,
        preamble: statement.preamble,
        clauses: statement.clauses.map(({ key, title, text }) => ({ key, title, text })),
        affirmedOn: latest.affirmedAt.toISOString(),
      };
    }
  }

  const badge = affirmedStatement ? (
    <StatementBadge channelName={channel.name} {...affirmedStatement} />
  ) : null;

  const following = await isFollowing(channel.id);
  const initials = channel.name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header>
        {channel.bannerUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={channel.bannerUrl}
            alt=""
            className="-mx-4 mb-5 aspect-[4/1] w-[calc(100%+2rem)] max-w-none object-cover sm:mx-0 sm:w-full sm:rounded-2xl"
          />
        )}
        {/* Mobile: link-in-bio hero (the Maltivas mobile pattern, CF amber) */}
        <div className="flex flex-col items-center text-center sm:hidden">
          <div className={`rounded-full bg-linear-to-br from-amber-500 to-orange-600 p-1 shadow-lg shadow-amber-500/20 ${channel.bannerUrl ? "-mt-14" : ""}`}>
            {channel.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={channel.avatarUrl}
                alt=""
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-2xl font-bold text-amber-600 dark:bg-neutral-950 dark:text-amber-400">
                {initials}
              </div>
            )}
          </div>
          <h1 className="mt-3 text-2xl font-semibold">{channel.name}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            @{channel.handle} · {channel._count.followers} followers
          </p>
          {channel.bio && (
            <p className="mt-2 line-clamp-3 max-w-xs text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              {channel.bio}
            </p>
          )}
          <div className="mt-4">
            <FollowButton
              channelId={channel.id}
              initialFollowing={following}
              initialFollowers={channel._count.followers}
            />
          </div>
          {badge && <div className="mt-3">{badge}</div>}
        </div>

        {/* Desktop: the full header */}
        <div className="hidden sm:block">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {channel.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={channel.avatarUrl}
                  alt=""
                  className={`h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-amber-500/60 ${channel.bannerUrl ? "-mt-10 h-20 w-20 ring-4 ring-white dark:ring-neutral-950" : ""}`}
                />
              ) : null}
              <div>
              <h1 className="text-3xl font-semibold">{channel.name}</h1>
              <p className="mt-1 text-sm text-neutral-500">
                @{channel.handle} · {channel._count.contentItems} items
                {bookCount > 0 && <> · {bookCount} books</>}
              </p>
              {badge && <div className="mt-2">{badge}</div>}
              </div>
            </div>
            <FollowButton
              channelId={channel.id}
              initialFollowing={following}
              initialFollowers={channel._count.followers}
            />
          </div>
          {channel.bio && (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              {channel.bio}
            </p>
          )}
          {channel.links != null && Object.keys(channel.links).length > 0 && (
            <p className="mt-3 flex flex-wrap gap-3 text-sm">
              {Object.entries(channel.links as Record<string, string>).map(
                ([key, url]) => (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="capitalize text-neutral-500 underline-offset-2 hover:text-amber-600 hover:underline"
                  >
                    {key}
                  </a>
                ),
              )}
            </p>
          )}
        </div>

        {tabs.length > 1 && <ChannelTabs handle={channel.handle} tabs={tabs} />}
      </header>

      <div className="mt-8">{children}</div>

      <p className="mt-12 border-t border-neutral-200 pt-4 text-xs text-neutral-400 dark:border-neutral-800">
        <Link href="/map" className="hover:underline">
          Explore how this teaching sits on the map →
        </Link>
      </p>
    </main>
  );
}
