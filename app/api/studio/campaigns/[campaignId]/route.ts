import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { validateCampaignDraft } from "@/lib/campaigns";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";

// Per-campaign management: edit (draft; copy-only while live), launch
// (§9.4 payout gate), cancel, delete (draft only).

async function requireManager(userId: string, campaignId: string) {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    include: { channel: { select: { id: true, status: true, stripePayoutsEnabled: true, stripeChargesEnabled: true } } },
  });
  if (!campaign) return { error: "Campaign not found", status: 404 } as const;
  const access = await getChannelAccess(
    userId,
    campaign.channelId,
    FEATURES.LIBRARY,
    ACCESS_LEVELS.MANAGER,
  );
  if (!access.authorized) return { error: "Forbidden", status: 403 } as const;
  return { campaign } as const;
}

const PatchSchema = z.object({
  action: z.enum(["edit", "launch", "cancel", "reactivate"]).default("edit"),
  title: z.string().min(1).max(200).optional(),
  shortDescription: z.string().min(1).max(2000).optional(),
  story: z.string().max(50_000).nullable().optional(),
  goalCents: z.number().int().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  deliverable: z.string().max(2000).nullable().optional(),
  deliveryTimeline: z.string().max(200).nullable().optional(),
  coverImageUrl: z.string().url().max(500).nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campaignId } = await params;

  const gate = await requireManager(userId, campaignId);
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  const { campaign } = gate;

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const body = parsed.data;

  if (body.action === "cancel") {
    if (campaign.status === "CANCELLED") return NextResponse.json({ ok: true });
    await db.campaign.update({
      where: { id: campaign.id },
      data: { status: "CANCELLED" },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "reactivate") {
    if (campaign.status !== "CANCELLED") {
      return NextResponse.json(
        { error: "Only cancelled campaigns can be reactivated." },
        { status: 409 },
      );
    }
    // Never launched → back to draft. Launched → back to taking pledges,
    // unless its end date has already passed (the cron would immediately
    // close it again — the creator should recreate with a fresh window).
    if (!campaign.publishedAt) {
      await db.campaign.update({ where: { id: campaign.id }, data: { status: "DRAFT" } });
      return NextResponse.json({ ok: true, status: "DRAFT" });
    }
    if (campaign.endsAt && campaign.endsAt.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "This campaign's end date has passed — create a new campaign instead." },
        { status: 409 },
      );
    }
    const status = campaign.raisedCents >= campaign.goalCents ? "FUNDED" : "LIVE";
    await db.campaign.update({ where: { id: campaign.id }, data: { status } });
    return NextResponse.json({ ok: true, status });
  }

  if (body.action === "launch") {
    if (campaign.status !== "DRAFT") {
      return NextResponse.json({ error: "Only drafts can launch." }, { status: 409 });
    }
    if (campaign.channel.status !== "APPROVED") {
      return NextResponse.json({ error: "Channel must be approved first." }, { status: 409 });
    }
    // §9.4: no payouts → no revenue surfaces.
    if (!campaign.channel.stripeChargesEnabled || !campaign.channel.stripePayoutsEnabled) {
      return NextResponse.json(
        { error: "Finish Stripe onboarding before launching — pledges pay you directly." },
        { status: 409 },
      );
    }
    const invalid = validateCampaignDraft({
      title: campaign.title,
      category: campaign.category,
      shortDescription: campaign.shortDescription,
      goalCents: campaign.goalCents,
      endsAt: campaign.endsAt,
      deliverable: campaign.deliverable,
    });
    if (invalid) return NextResponse.json({ error: invalid }, { status: 422 });
    if (!campaign.coverImageUrl) {
      return NextResponse.json(
        { error: "Add a cover image before launching — it's the face of the campaign." },
        { status: 422 },
      );
    }

    await db.campaign.update({
      where: { id: campaign.id },
      data: { status: "LIVE", publishedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  // edit — full edits on drafts; copy/media-only once live.
  const live = campaign.status !== "DRAFT";
  if (live && (body.goalCents !== undefined || body.endsAt !== undefined)) {
    return NextResponse.json(
      { error: "Goal and end date are locked once a campaign is live." },
      { status: 409 },
    );
  }
  const data = {
    ...(body.title !== undefined ? { title: body.title.trim() } : {}),
    ...(body.shortDescription !== undefined
      ? { shortDescription: body.shortDescription.trim() }
      : {}),
    ...(body.story !== undefined
      ? { story: body.story?.trim() ? sanitizeRichHtml(body.story.trim()) : null }
      : {}),
    ...(body.deliverable !== undefined
      ? { deliverable: body.deliverable?.trim() || null }
      : {}),
    ...(body.deliveryTimeline !== undefined
      ? { deliveryTimeline: body.deliveryTimeline?.trim() || null }
      : {}),
    ...(body.coverImageUrl !== undefined ? { coverImageUrl: body.coverImageUrl } : {}),
    ...(!live && body.goalCents !== undefined ? { goalCents: body.goalCents } : {}),
    ...(!live && body.endsAt !== undefined
      ? { endsAt: body.endsAt ? new Date(body.endsAt) : null }
      : {}),
  };
  const next = { ...campaign, ...data };
  const invalid = validateCampaignDraft({
    title: next.title,
    category: next.category,
    shortDescription: next.shortDescription,
    goalCents: next.goalCents,
    endsAt: next.endsAt,
    deliverable: next.deliverable,
  });
  if (invalid) return NextResponse.json({ error: invalid }, { status: 422 });

  const updated = await db.campaign.update({ where: { id: campaign.id }, data });
  return NextResponse.json({ campaign: updated });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campaignId } = await params;

  const gate = await requireManager(userId, campaignId);
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  if (gate.campaign.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Only drafts can be deleted — cancel a live campaign instead." },
      { status: 409 },
    );
  }
  await db.campaignUpdate.deleteMany({ where: { campaignId } });
  await db.campaignReward.deleteMany({ where: { campaignId } });
  await db.campaign.delete({ where: { id: campaignId } });
  return NextResponse.json({ ok: true });
}
