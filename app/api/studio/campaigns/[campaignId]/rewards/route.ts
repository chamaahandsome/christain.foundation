import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";

// Reward tiers. Creating/editing is allowed on drafts and live campaigns
// (creators add tiers mid-campaign, Maltivas-style); a reward that has
// backers can only be deactivated, never deleted.

async function requireManager(userId: string, campaignId: string) {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, channelId: true, status: true },
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

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  amountCents: z.number().int().min(100),
  maxBackers: z.number().int().min(1).nullable().optional(),
  sortOrder: z.number().int().optional(),
  imageUrl: z.string().url().max(500).nullable().optional(),
  deliveryType: z.enum(["digital", "physical"]).optional(),
});

const PatchSchema = CreateSchema.partial().extend({
  rewardId: z.string().min(1),
  active: z.boolean().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campaignId } = await params;
  const gate = await requireManager(userId, campaignId);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const body = parsed.data;
  const reward = await db.campaignReward.create({
    data: {
      campaignId,
      title: body.title.trim(),
      description: body.description.trim(),
      amountCents: body.amountCents,
      maxBackers: body.maxBackers ?? null,
      sortOrder: body.sortOrder ?? 0,
      imageUrl: body.imageUrl ?? null,
      deliveryType: body.deliveryType ?? "digital",
    },
  });
  return NextResponse.json({ reward });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campaignId } = await params;
  const gate = await requireManager(userId, campaignId);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { rewardId, ...body } = parsed.data;
  const reward = await db.campaignReward.findUnique({ where: { id: rewardId } });
  if (!reward || reward.campaignId !== campaignId) {
    return NextResponse.json({ error: "Reward not found" }, { status: 404 });
  }
  const updated = await db.campaignReward.update({
    where: { id: rewardId },
    data: {
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.description !== undefined ? { description: body.description.trim() } : {}),
      ...(body.amountCents !== undefined ? { amountCents: body.amountCents } : {}),
      ...(body.maxBackers !== undefined ? { maxBackers: body.maxBackers } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      ...(body.imageUrl !== undefined ? { imageUrl: body.imageUrl } : {}),
      ...(body.deliveryType !== undefined ? { deliveryType: body.deliveryType } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
    },
  });
  return NextResponse.json({ reward: updated });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campaignId } = await params;
  const gate = await requireManager(userId, campaignId);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const { rewardId } = await req.json().catch(() => ({}));
  if (!rewardId) return NextResponse.json({ error: "rewardId required" }, { status: 400 });
  const reward = await db.campaignReward.findUnique({ where: { id: rewardId } });
  if (!reward || reward.campaignId !== campaignId) {
    return NextResponse.json({ error: "Reward not found" }, { status: 404 });
  }
  if (reward.backersCount > 0) {
    return NextResponse.json(
      { error: "This reward has backers — deactivate it instead." },
      { status: 409 },
    );
  }
  await db.campaignReward.delete({ where: { id: rewardId } });
  return NextResponse.json({ ok: true });
}
