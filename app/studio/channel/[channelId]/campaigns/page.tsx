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
      include: {
        rewards: { orderBy: [{ sortOrder: "asc" }, { amountCents: "asc" }] },
        pledges: {
          where: { status: "SUCCEEDED" },
          orderBy: { createdAt: "desc" },
          include: {
            reward: { select: { title: true } },
          },
        },
      },
    }),
    db.channel.findUnique({
      where: { id: channelId },
      select: { stripeChargesEnabled: true, stripePayoutsEnabled: true },
    }),
  ]);

  const backerIds = [
    ...new Set(campaigns.flatMap((c) => c.pledges.map((p) => p.userId))),
  ];
  const backerNames = new Map(
    (
      await db.user.findMany({
        where: { id: { in: backerIds } },
        select: { id: true, name: true },
      })
    ).map((u) => [u.id, u.name ?? "Supporter"]),
  );

  return (
    <CampaignsManager
      channelId={channelId}
      canEdit={canEdit}
      isOwner={access.isOwner}
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
          imageUrl: r.imageUrl,
          deliveryType: r.deliveryType,
        })),
        backers: c.pledges.map((pl) => {
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
            name: backerNames.get(pl.userId) ?? "Supporter",
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
            provider: pl.provider,
            refundable: pl.provider === "stripe" && Boolean(pl.providerRef),
          };
        }),
      }))}
    />
  );
}
