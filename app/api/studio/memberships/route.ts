import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { validateTier } from "@/lib/membership";
import { getChannelAccess } from "@/lib/team-authorization";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";

// Membership tier management — owner-only, like everything on the money tab.

async function requireOwner(userId: string, channelId: string) {
  const access = await getChannelAccess(
    userId,
    channelId,
    FEATURES.MEMBERSHIPS,
    ACCESS_LEVELS.MANAGER,
  );
  if (!access.channel) return { error: "Channel not found", status: 404 } as const;
  if (!access.authorized) return { error: "Forbidden", status: 403 } as const;
  return { ok: true } as const;
}

const CreateSchema = z.object({
  channelId: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(2000),
  priceCents: z.number().int(),
});

const PatchSchema = z.object({
  channelId: z.string().min(1),
  tierId: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  description: z.string().min(1).max(2000).optional(),
  active: z.boolean().optional(),
  // Price is immutable once anyone is subscribed — existing subscriptions
  // bill the old price and the mismatch would mislead new members.
  priceCents: z.number().int().optional(),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const body = parsed.data;
  const gate = await requireOwner(userId, body.channelId);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const invalid = validateTier(body);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 422 });

  const tier = await db.membershipTier.create({
    data: {
      channelId: body.channelId,
      name: body.name.trim(),
      description: body.description.trim(),
      priceCents: body.priceCents,
    },
  });
  return NextResponse.json({ tier });
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const body = parsed.data;
  const gate = await requireOwner(userId, body.channelId);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const tier = await db.membershipTier.findUnique({ where: { id: body.tierId } });
  if (!tier || tier.channelId !== body.channelId) {
    return NextResponse.json({ error: "Tier not found" }, { status: 404 });
  }
  if (body.priceCents !== undefined && tier.membersCount > 0) {
    return NextResponse.json(
      { error: "A tier with members keeps its price — add a new tier instead." },
      { status: 409 },
    );
  }
  const next = {
    name: body.name ?? tier.name,
    description: body.description ?? tier.description,
    priceCents: body.priceCents ?? tier.priceCents,
  };
  const invalid = validateTier(next);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 422 });

  const updated = await db.membershipTier.update({
    where: { id: tier.id },
    data: { ...next, ...(body.active !== undefined ? { active: body.active } : {}) },
  });
  return NextResponse.json({ tier: updated });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { channelId, tierId } = await req.json().catch(() => ({}));
  if (!channelId || !tierId) {
    return NextResponse.json({ error: "channelId and tierId required" }, { status: 400 });
  }
  const gate = await requireOwner(userId, channelId);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const tier = await db.membershipTier.findUnique({ where: { id: tierId } });
  if (!tier || tier.channelId !== channelId) {
    return NextResponse.json({ error: "Tier not found" }, { status: 404 });
  }
  if (tier.membersCount > 0) {
    return NextResponse.json(
      { error: "This tier has members — deactivate it instead." },
      { status: 409 },
    );
  }
  await db.membershipTier.delete({ where: { id: tierId } });
  return NextResponse.json({ ok: true });
}
