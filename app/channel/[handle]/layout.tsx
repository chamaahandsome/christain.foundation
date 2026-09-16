import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { affirmationComplete } from "@/lib/gate";
import { ChannelTabs, type ChannelTab } from "@/components/ChannelTabs";
import { FollowButton } from "@/components/FollowButton";
import { StatementBadge } from "@/components/StatementBadge";

// ISR (SCALABILITY §3.1): the channel header is the same for every viewer —
// the follow state is the one per-user bit, and FollowButton resolves it
// client-side. Cached per handle, re-rendered at most once per 60s.
export const revalidate = 60;

// The creator's public home (/@handle): one header, tabbed content below.
// Tabs appear as the channel grows — Videos, Books today; Shop, Campaigns,
// and Support join as commerce, crowdfunding, and giving land.

async function getChannel(handle: string) {
  return db.channel.findUnique({
    where: { handle },
    include: { _count: { select: { followers: true, contentItems: true } } },
  });
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
    ...(bookCount > 0 ? [{ slug: "books", label: "eBooks" }] : []),
    ...(campaignCount > 0 ? [{ slug: "campaigns", label: "Campaigns" }] : []),
    ...(channel.bookingEnabled ? [{ slug: "book", label: "Book Me" }] : []),
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

  const initials = channel.name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header>
        {/* The banner carries the channel's name, and the avatar sits half in,
            half out of its bottom edge. A channel without a banner of its own
            gets the brand gradient, so the name always has a ground to sit on.
            Full-bleed on a phone, a rounded card from sm up. */}
        <div className="relative -mx-4 sm:mx-0">
          {channel.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={channel.bannerUrl}
              alt=""
              className="aspect-[5/2] w-full object-cover sm:aspect-[4/1] sm:rounded-2xl"
            />
          ) : (
            <div className="aspect-[5/2] w-full bg-linear-to-br from-amber-500 to-orange-600 sm:aspect-[4/1] sm:rounded-2xl" />
          )}
          {/* Scrim: keeps the white name legible on any banner. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-linear-to-t from-black/75 via-black/30 to-transparent sm:rounded-b-2xl"
          />

          {/* Name and handle, to the right of the avatar's upper half. */}
          <div className="absolute inset-x-0 bottom-0 pb-3 pl-27 pr-4 sm:pb-4 sm:pl-39 sm:pr-6">
            <h1 className="truncate text-xl font-semibold text-white drop-shadow-sm sm:text-3xl">
              {channel.name}
            </h1>
            <p className="truncate text-sm text-white/85 drop-shadow-sm">
              @{channel.handle}
            </p>
          </div>

          <div className="absolute bottom-0 left-4 translate-y-1/2 sm:left-6">
            {channel.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={channel.avatarUrl}
                alt=""
                className="h-20 w-20 rounded-full object-cover shadow-md ring-4 ring-white sm:h-28 sm:w-28 dark:ring-neutral-950"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-2xl font-bold text-amber-600 shadow-md ring-4 ring-white sm:h-28 sm:w-28 sm:text-3xl dark:bg-neutral-950 dark:text-amber-400 dark:ring-neutral-950">
                {initials}
              </div>
            )}
          </div>
        </div>

        {/* Beside the avatar's lower half: what the channel holds, and Follow.
            The min height clears the part of the avatar below the banner. */}
        <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2 pl-23 pt-2 sm:min-h-16 sm:pl-39 sm:pt-3">
          <p className="text-sm text-neutral-500">
            {channel._count.contentItems} items
            {bookCount > 0 && (
              <>
                {" "}
                · {bookCount} {bookCount === 1 ? "book" : "books"}
              </>
            )}
          </p>
          <FollowButton
            channelId={channel.id}
            initialFollowers={channel._count.followers}
          />
        </div>

        {badge && <div className="mt-3">{badge}</div>}
        {channel.bio && (
          <p className="mt-3 line-clamp-3 max-w-2xl text-sm leading-6 text-neutral-600 sm:line-clamp-none dark:text-neutral-400">
            {channel.bio}
          </p>
        )}
        {/* On a phone the Home stack carries the links (Linktree-style). */}
        {channel.links != null && Object.keys(channel.links).length > 0 && (
          <p className="mt-3 hidden flex-wrap gap-3 text-sm sm:flex">
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
