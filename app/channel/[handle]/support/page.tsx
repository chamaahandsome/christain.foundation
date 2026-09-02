import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { CUP_VERSE, CUP_VERSE_REF, tipDisclosure } from "@/lib/giving";
import { TipCard } from "@/components/TipCard";
import { JoinMembership } from "@/components/JoinMembership";
import { membershipCurrent } from "@/lib/membership";

export const dynamic = "force-dynamic";
export const metadata = { title: "Support" };

// "A Cup of Cold Water" (§9 Mode B): small gifts, straight to the creator.
export default async function ChannelSupportPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ thanks?: string; trickl?: string; member?: string }>;
}) {
  const { handle } = await params;
  const { thanks, trickl, member } = await searchParams;
  const channel = await db.channel.findUnique({
    where: { handle },
    select: {
      id: true,
      name: true,
      status: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      tricklProviderLinkCode: true,
    },
  });
  if (!channel || channel.status !== "APPROVED") notFound();

  const { userId } = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    ? await auth()
    : { userId: null };

  const tiers = await db.membershipTier.findMany({
    where: { channelId: channel.id, active: true },
    orderBy: [{ sortOrder: "asc" }, { priceCents: "asc" }],
    select: { id: true, name: true, description: true, priceCents: true },
  });
  const myMembership = userId
    ? await db.channelMembership.findUnique({
        where: { channelId_userId: { channelId: channel.id, userId } },
        include: { tier: { select: { name: true } } },
      })
    : null;
  const memberTierName =
    myMembership && membershipCurrent(myMembership) ? myMembership.tier.name : null;

  if (!channel.stripeChargesEnabled || !channel.stripePayoutsEnabled) {
    return (
      <p className="text-sm text-neutral-500">
        {channel.name} isn&apos;t set up to receive gifts yet.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      {trickl === "started" && (
        <div className="mb-6 rounded-xl border border-teal-300 bg-teal-50 p-4 text-sm leading-6 text-teal-900 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
          💧 Your Trickl gift is set up — spare change will make its way to{" "}
          {channel.name} in small chunks. Thank you.
        </div>
      )}
      {member && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          ⭐ Welcome — your membership with {channel.name} is active. Members-only
          content is unlocked.
        </div>
      )}
      {thanks && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          💧 Your cup of cold water is on its way to {channel.name}. “He will
          by no means lose his reward” — and neither will you. Thank you.
        </div>
      )}

      <blockquote className="border-l-3 border-amber-500 pl-4">
        <p className="text-sm italic leading-6 text-neutral-600 dark:text-neutral-400">
          “{CUP_VERSE}”
        </p>
        <cite className="mt-1 block text-xs font-medium not-italic text-amber-700 dark:text-amber-400">
          {CUP_VERSE_REF}
        </cite>
      </blockquote>

      <p className="mt-4 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
        Receive a prophet, and you share the prophet&apos;s reward. A cup of
        cold water is a small way to stand with {channel.name}&apos;s work —
        not a purchase, not a pledge, just refreshment for the road.
      </p>

      <div className="mt-6">
        <TipCard
          channelId={channel.id}
          channelName={channel.name}
          signedIn={Boolean(userId)}
          tricklEnabled={Boolean(channel.tricklProviderLinkCode)}
        />
      </div>

      <p className="mt-4 text-xs leading-5 text-neutral-500">
        {tipDisclosure(channel.name)}
      </p>

      {(tiers.length > 0 || memberTierName) && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Membership</h2>
          <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            Walk with {channel.name} month by month and unlock members-only
            content.
          </p>
          <div className="mt-4">
            <JoinMembership
              channelId={channel.id}
              channelName={channel.name}
              tiers={tiers}
              signedIn={Boolean(userId)}
              memberTierName={memberTierName}
            />
          </div>
        </section>
      )}
    </div>
  );
}
