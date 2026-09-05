import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getChannelAccess } from "@/lib/team-authorization";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";

// Bookable services (the Maltivas hire_service shape): what can be booked,
// at what rate, on which days, and whether it's visible on the public page.

const DAY_CODES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

const CreateSchema = z.object({
  channelId: z.string().min(1),
  title: z.string().min(2).max(150),
  category: z.enum(["speaking", "teaching", "worship", "other"]).default("speaking"),
  description: z.string().min(10).max(3000),
  rateCents: z.number().int().min(0).nullable().optional(),
  rateUnit: z.enum(["hour", "day", "event", "project"]).default("event"),
  requirements: z.string().max(3000).optional(),
  availableDays: z.array(z.enum(DAY_CODES)).max(7).optional(),
  visible: z.boolean().default(true),
});

const PatchSchema = CreateSchema.partial().extend({
  channelId: z.string().min(1),
  serviceId: z.string().min(1),
  active: z.boolean().optional(),
});

async function requireOwner(userId: string, channelId: string) {
  const access = await getChannelAccess(
    userId,
    channelId,
    FEATURES.BUSINESS,
    ACCESS_LEVELS.MANAGER,
  );
  if (!access.channel) return { error: "Channel not found", status: 404 } as const;
  if (!access.authorized) return { error: "Forbidden", status: 403 } as const;
  return { ok: true } as const;
}

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

  const service = await db.bookableService.create({
    data: {
      channelId: body.channelId,
      title: body.title.trim(),
      category: body.category,
      description: body.description.trim(),
      rateCents: body.rateCents ?? null,
      rateUnit: body.rateUnit,
      requirements: body.requirements?.trim() || null,
      availableDays: body.availableDays ?? [],
      visible: body.visible,
    },
  });
  return NextResponse.json({ service });
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { channelId, serviceId, ...body } = parsed.data;
  const gate = await requireOwner(userId, channelId);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const service = await db.bookableService.findUnique({ where: { id: serviceId } });
  if (!service || service.channelId !== channelId) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }
  const updated = await db.bookableService.update({
    where: { id: serviceId },
    data: {
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.description !== undefined ? { description: body.description.trim() } : {}),
      ...(body.rateCents !== undefined ? { rateCents: body.rateCents } : {}),
      ...(body.rateUnit !== undefined ? { rateUnit: body.rateUnit } : {}),
      ...(body.requirements !== undefined
        ? { requirements: body.requirements?.trim() || null }
        : {}),
      ...(body.availableDays !== undefined ? { availableDays: body.availableDays } : {}),
      ...(body.visible !== undefined ? { visible: body.visible } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
    },
  });
  return NextResponse.json({ service: updated });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { channelId, serviceId } = await req.json().catch(() => ({}));
  if (!channelId || !serviceId) {
    return NextResponse.json({ error: "channelId and serviceId required" }, { status: 400 });
  }
  const gate = await requireOwner(userId, channelId);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const service = await db.bookableService.findUnique({ where: { id: serviceId } });
  if (!service || service.channelId !== channelId) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }
  await db.bookableService.delete({ where: { id: serviceId } });
  return NextResponse.json({ ok: true });
}
