import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { ChannelTabs, type ChannelTab } from "@/components/ChannelTabs";
import { FollowButton } from "@/components/FollowButton";

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

  const bookCount = await db.ebook.count({
    where: { channelId: channel.id, published: true },
  });

  const tabs: ChannelTab[] = [
    { slug: "", label: "Home" },
    ...(channel._count.contentItems > 0 ? [{ slug: "videos", label: "Videos" }] : []),
    ...(bookCount > 0 ? [{ slug: "books", label: "Books" }] : []),
    // Coming as the features land — same list, new entries:
    // { slug: "shop", label: "Shop" }, { slug: "campaigns", label: "Campaigns" },
    // { slug: "support", label: "Support" } (giving — §9 machinery, phase 7)
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl">{channel.name}</h1>
            <p className="mt-1 text-sm text-neutral-500">
              @{channel.handle} · {channel._count.contentItems} items
              {bookCount > 0 && <> · {bookCount} books</>}
            </p>
          </div>
          <FollowButton
            channelId={channel.id}
            initialFollowing={await isFollowing(channel.id)}
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
