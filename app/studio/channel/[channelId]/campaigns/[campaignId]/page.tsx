import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";
import { CampaignStudio } from "@/components/CampaignStudio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Campaign" };

// The campaign workspace: Overview | Rewards | Updates | Backers | Edit |
// Settings (the Maltivas CampaignEditTabs).
export default async function CampaignWorkspace({
  params,
}: {
  params: Promise<{ channelId: string; campaignId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/signin");
  const { channelId, campaignId } = await params;
  const access = await getChannelAccess(
    userId,
    channelId,
    FEATURES.CAMPAIGNS,
    ACCESS_LEVELS.MANAGER,
  );
  if (!access.channel || !access.authorized) notFound();

  const [campaign, channel] = await Promise.all([
    db.campaign.findUnique({
      where: { id: campaignId },
      include: {
        rewards: { orderBy: [{ sortOrder: "asc" }, { amountCents: "asc" }] },
        updates: { orderBy: { createdAt: "desc" } },
        pledges: {
          where: { status: "SUCCEEDED" },
          orderBy: { createdAt: "desc" },
          include: { reward: { select: { title: true } } },
        },
      },
    }),
    db.channel.findUniqueOrThrow({
      where: { id: channelId },
      select: { stripeChargesEnabled: true, stripePayoutsEnabled: true },
    }),
  ]);
  if (!campaign || campaign.channelId !== channelId) notFound();

  const backerIds = [...new Set(campaign.pledges.map((p) => p.userId))];
  const names = new Map(
    (
      await db.user.findMany({
        where: { id: { in: backerIds } },
        select: { id: true, name: true },
      })
    ).map((u) => [u.id, u.name ?? "Supporter"]),
  );

  return (
    <CampaignStudio
      channelId={channelId}
      payoutsReady={channel.stripeChargesEnabled && channel.stripePayoutsEnabled}
      isOwner={access.isOwner}
      campaign={{
        id: campaign.id,
        title: campaign.title,
        slug: campaign.slug,
        category: campaign.category,
        status: campaign.status,
        shortDescription: campaign.shortDescription,
        story: campaign.story,
        coverImageUrl: campaign.coverImageUrl,
        videoUrl: campaign.videoUrl,
        goalCents: campaign.goalCents,
        raisedCents: campaign.raisedCents,
        backersCount: campaign.backersCount,
        endsAt: campaign.endsAt?.toLocaleDateString() ?? null,
        endsAtDate: campaign.endsAt?.toISOString().slice(0, 10) ?? null,
        deliverable: campaign.deliverable,
        deliveryTimeline: campaign.deliveryTimeline,
        publishedAt: campaign.publishedAt?.toLocaleDateString() ?? null,
        rewards: campaign.rewards.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          amountCents: r.amountCents,
          maxBackers: r.maxBackers,
          backersCount: r.backersCount,
          active: r.active,
          imageUrl: r.imageUrl,
          deliveryType: r.deliveryType,
        })),
        updates: campaign.updates.map((u) => ({
          id: u.id,
          title: u.title,
          backersOnly: u.backersOnly,
          date: u.createdAt.toLocaleDateString(),
        })),
        backers: campaign.pledges.map((pl) => {
          const ship = pl.shippingAddress as {
            name?: string;
            address?: {
              line1?: string;
              line2?: string;
              city?: string;
              state?: string;
              postal_code?: string;
              country?: string;
            };
          } | null;
          const a = ship?.address;
          return {
            id: pl.id,
            name: names.get(pl.userId) ?? "Supporter",
            amountCents: pl.amountCents,
            rewardTitle: pl.reward?.title ?? null,
            message: pl.message,
            anonymous: pl.anonymous,
            shipping: a
              ? [
                  ship?.name,
                  a.line1,
                  a.line2,
                  [a.city, a.state, a.postal_code].filter(Boolean).join(", "),
                  a.country,
                ]
                  .filter(Boolean)
                  .join("\n")
              : null,
            date: pl.createdAt.toLocaleDateString(),
            refundable: pl.provider === "stripe" && Boolean(pl.providerRef),
          };
        }),
      }}
    />
  );
}
