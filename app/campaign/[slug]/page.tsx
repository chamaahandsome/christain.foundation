import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { TransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import {
  campaignOpen,
  daysLeft,
  pledgeDisclosure,
  rewardDisclaimer,
} from "@/lib/campaigns";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { CampaignDetail } from "@/components/CampaignDetail";
import { extractYouTubeId } from "@/components/CampaignLivePreviewCF";

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

  const recentPledges = await db.campaignPledge.findMany({
    where: { campaignId: campaign.id, status: TransactionStatus.SUCCEEDED },
    orderBy: { createdAt: "desc" },
    take: 12,
    select: { id: true, userId: true, amountCents: true, anonymous: true, createdAt: true },
  });
  const backerNames = new Map(
    (
      await db.user.findMany({
        where: { id: { in: [...new Set(recentPledges.map((p) => p.userId))] } },
        select: { id: true, name: true },
      })
    ).map((u) => [u.id, u.name ?? "Supporter"]),
  );

  const open = campaignOpen(campaign);
  const left = daysLeft(campaign.endsAt);
  const visibleUpdates = campaign.updates.filter((u) => !u.backersOnly || isBacker);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {thanks && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          🤝 Your pledge is in — thank you for standing with {campaign.channel.name}.{" "}
          <Link href="/backed" className="underline">
            See everything you've backed →
          </Link>
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

      <CampaignDetail
        campaignId={campaign.id}
        category={campaign.category}
        channelName={campaign.channel.name}
        signedIn={Boolean(userId)}
        tricklEnabled={Boolean(campaign.channel.tricklProviderLinkCode)}
        open={open}
        storyHtml={campaign.story ? sanitizeRichHtml(campaign.story) : null}
        videoId={campaign.videoUrl ? extractYouTubeId(campaign.videoUrl) : null}
        coverImageUrl={campaign.coverImageUrl}
        raisedCents={campaign.raisedCents}
        goalCents={campaign.goalCents}
        backersCount={campaign.backersCount}
        daysLeft={left}
        updates={visibleUpdates.map((u) => ({
          id: u.id,
          title: u.title,
          bodyHtml: sanitizeRichHtml(u.body),
          date: u.createdAt.toLocaleDateString(),
          backersOnly: u.backersOnly,
        }))}
        backers={recentPledges.map((pl) => ({
          id: pl.id,
          name: pl.anonymous ? "Anonymous" : (backerNames.get(pl.userId) ?? "Supporter"),
          amountCents: pl.amountCents,
          date: pl.createdAt.toLocaleDateString(),
        }))}
        rewards={campaign.rewards.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          amountCents: r.amountCents,
          maxBackers: r.maxBackers,
          backersCount: r.backersCount,
          active: r.active,
          imageUrl: r.imageUrl,
          deliveryType: r.deliveryType,
        }))}
      />

      <p className="mt-6 text-xs leading-5 text-neutral-500">
        {pledgeDisclosure(campaign.category, campaign.channel.name)}
        {campaign.rewards.some((r) => r.active) && (
          <> {rewardDisclaimer(campaign.channel.name)}</>
        )}
      </p>

    </main>
  );
}
