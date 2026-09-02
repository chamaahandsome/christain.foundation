import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { TransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { campaignOpen, daysLeft, pledgeDisclosure, progressPercent } from "@/lib/campaigns";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { PledgeCard } from "@/components/PledgeCard";
import { CampaignTabs } from "@/components/CampaignTabs";

export const dynamic = "force-dynamic";

async function getCampaign(slug: string) {
  return db.campaign.findUnique({
    where: { slug },
    include: {
      channel: {
        select: {
          id: true,
          name: true,
          handle: true,
          status: true,
          avatarUrl: true,
          tricklProviderLinkCode: true,
        },
      },
      rewards: { orderBy: [{ sortOrder: "asc" }, { amountCents: "asc" }] },
      updates: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const campaign = await getCampaign(slug).catch(() => null);
  if (!campaign || campaign.status === "DRAFT") return {};
  return {
    title: campaign.title,
    description: campaign.shortDescription.slice(0, 160),
    openGraph: {
      title: campaign.title,
      description: campaign.shortDescription.slice(0, 200),
      ...(campaign.coverImageUrl ? { images: [campaign.coverImageUrl] } : {}),
    },
  };
}

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ thanks?: string; trickl?: string }>;
}) {
  const { slug } = await params;
  const { thanks, trickl } = await searchParams;
  const campaign = await getCampaign(slug);
  if (
    !campaign ||
    campaign.status === "DRAFT" ||
    campaign.status === "CANCELLED" ||
    campaign.channel.status !== "APPROVED"
  ) {
    notFound();
  }

  const { userId } = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    ? await auth()
    : { userId: null };

  const isBacker = userId
    ? (await db.campaignPledge.findFirst({
        where: { campaignId: campaign.id, userId, status: TransactionStatus.SUCCEEDED },
        select: { id: true },
      })) !== null
    : false;

  const open = campaignOpen(campaign);
  const pct = progressPercent(campaign.raisedCents, campaign.goalCents);
  const left = daysLeft(campaign.endsAt);
  const visibleUpdates = campaign.updates.filter((u) => !u.backersOnly || isBacker);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {thanks && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          🤝 Your pledge is in — thank you for standing with {campaign.channel.name}.
        </div>
      )}
      {trickl === "started" && (
        <div className="mb-6 rounded-xl border border-teal-300 bg-teal-50 p-4 text-sm leading-6 text-teal-900 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200">
          💧 Your Trickl pledge is set up — spare change will carry it to{" "}
          {campaign.channel.name} in small chunks.
        </div>
      )}

      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        {campaign.category === "MISSION" ? "Mission campaign" : "Creative campaign"}
        {campaign.status === "FUNDED" && " · funded"}
      </p>
      <h1 className="mt-2 text-3xl font-semibold leading-tight">{campaign.title}</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        by{" "}
        <Link
          href={`/@${campaign.channel.handle}`}
          className="font-medium text-amber-700 hover:underline dark:text-amber-400"
        >
          {campaign.channel.name}
        </Link>
      </p>

      {campaign.coverImageUrl && (
        <div className="mt-6 overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={campaign.coverImageUrl} alt="" className="w-full object-cover" />
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-2xl font-semibold">
            ${(campaign.raisedCents / 100).toLocaleString()}
            <span className="ml-1 text-sm font-normal text-neutral-500">
              raised of ${(campaign.goalCents / 100).toLocaleString()}
            </span>
          </span>
          <span className="text-sm text-neutral-500">
            {campaign.backersCount} backer{campaign.backersCount === 1 ? "" : "s"}
            {left !== null && ` · ${left} day${left === 1 ? "" : "s"} left`}
          </span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
          <div
            className="h-full rounded-full bg-linear-to-r from-amber-500 to-orange-600"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <p className="mt-6 text-base leading-7 text-neutral-700 dark:text-neutral-300">
        {campaign.shortDescription}
      </p>

      {campaign.category === "CREATIVE" && campaign.deliverable && (
        <div className="mt-4 rounded-xl bg-neutral-50 p-4 text-sm leading-6 dark:bg-neutral-900/60">
          <p className="font-medium">What backers are funding</p>
          <p className="mt-1 text-neutral-600 dark:text-neutral-400">
            {campaign.deliverable}
          </p>
          {campaign.deliveryTimeline && (
            <p className="mt-1 text-xs text-neutral-500">
              Timeline: {campaign.deliveryTimeline}
            </p>
          )}
        </div>
      )}

      <div className="mt-6">
        {open ? (
          <PledgeCard
            campaignId={campaign.id}
            category={campaign.category}
            channelName={campaign.channel.name}
            signedIn={Boolean(userId)}
            tricklEnabled={Boolean(campaign.channel.tricklProviderLinkCode)}
            rewards={campaign.rewards.map((r) => ({
              id: r.id,
              title: r.title,
              description: r.description,
              amountCents: r.amountCents,
              maxBackers: r.maxBackers,
              backersCount: r.backersCount,
              active: r.active,
            }))}
          />
        ) : (
          <p className="rounded-xl border border-neutral-200 p-5 text-sm text-neutral-500 dark:border-neutral-800">
            This campaign has ended.
            {campaign.status === "FUNDED" && " It reached its goal — thank you."}
          </p>
        )}
      </div>

      <p className="mt-4 text-xs leading-5 text-neutral-500">
        {pledgeDisclosure(campaign.category, campaign.channel.name)}
      </p>

      <CampaignTabs
        storyHtml={campaign.story ? sanitizeRichHtml(campaign.story) : null}
        updates={visibleUpdates.map((u) => ({
          id: u.id,
          title: u.title,
          bodyHtml: sanitizeRichHtml(u.body),
          date: u.createdAt.toLocaleDateString(),
          backersOnly: u.backersOnly,
        }))}
      />

    </main>
  );
}
