import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";
import { CampaignsManager } from "@/components/CampaignsManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Campaigns" };

// Crowdfunding (concept §7b) — Mission & Creative campaigns, direct-support
// model: pledges route to the creator at payment time.
export default async function CampaignsTab({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/signin");

  const { channelId } = await params;
  const access = await getChannelAccess(userId, channelId, FEATURES.LIBRARY);
  if (!access.channel || !access.authorized) notFound();

  const canEdit =
    access.isOwner ||
    (access.featureAccess[FEATURES.LIBRARY] ?? "none") === ACCESS_LEVELS.MANAGER;

  const [campaigns, channel] = await Promise.all([
    db.campaign.findMany({
      where: { channelId },
      orderBy: { createdAt: "desc" },
      include: { rewards: { orderBy: [{ sortOrder: "asc" }, { amountCents: "asc" }] } },
    }),
    db.channel.findUnique({
      where: { id: channelId },
      select: { stripeChargesEnabled: true, stripePayoutsEnabled: true },
    }),
  ]);

  return (
    <CampaignsManager
      channelId={channelId}
      canEdit={canEdit}
      payoutsReady={Boolean(channel?.stripeChargesEnabled && channel?.stripePayoutsEnabled)}
      campaigns={campaigns.map((c) => ({
        id: c.id,
        title: c.title,
        slug: c.slug,
        category: c.category,
        status: c.status,
        shortDescription: c.shortDescription,
        story: c.story,
        coverImageUrl: c.coverImageUrl,
        goalCents: c.goalCents,
        raisedCents: c.raisedCents,
        backersCount: c.backersCount,
        endsAt: c.endsAt?.toISOString() ?? null,
        deliverable: c.deliverable,
        deliveryTimeline: c.deliveryTimeline,
        rewards: c.rewards.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          amountCents: r.amountCents,
          maxBackers: r.maxBackers,
          backersCount: r.backersCount,
          active: r.active,
        })),
      }))}
    />
  );
}
