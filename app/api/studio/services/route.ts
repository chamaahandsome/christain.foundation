import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseServiceExtras, parseServiceImages } from "@/lib/bookings";
import { validateSessionDraft } from "@/lib/sessions";
import { getChannelAccess } from "@/lib/team-authorization";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";

// Bookable things, both kinds. HIRE is the Maltivas hire_service shape:
// what can be booked, at what rate, on which days. ONLINE is the
// bagel-break appointment: a fixed-length 1:1, free or paid, that always
// books by slot and issues a meeting link on confirmation.

const DAY_CODES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

// Hire categories first, then the 1:1 ones — one list so a service can be
// re-categorised without the kind getting in the way.
const CATEGORIES = [
  "speaking",
  "teaching",
  "worship",
  "mentoring",
  "discipleship",
  "prayer",
  "counsel",
  "consultation",
  "other",
] as const;

const CreateSchema = z.object({
  channelId: z.string().min(1),
  kind: z.enum(["HIRE", "ONLINE"]).default("HIRE"),
  title: z.string().min(2).max(150),
  category: z.enum(CATEGORIES).default("speaking"),
  description: z.string().min(10).max(3000),
  rateCents: z.number().int().min(0).nullable().optional(),
  rateUnit: z.enum(["hour", "day", "event", "project"]).default("event"),
  privateRate: z.boolean().optional(),
  requirements: z.string().max(3000).optional(),
  availableDays: z.array(z.enum(DAY_CODES)).max(7).optional(),
  durationMins: z.number().int().min(0).max(10_000).nullable().optional(),
  extras: z.array(z.unknown()).max(20).optional(),
  images: z.array(z.string()).max(3).optional(),
  slotMinutes: z.number().int().min(5).max(480).nullable().optional(),
  dailyStart: z.string().regex(/^\d{1,2}:\d{2}$/).nullable().optional(),
  dailyEnd: z.string().regex(/^\d{1,2}:\d{2}$/).nullable().optional(),
  bufferMins: z.number().int().min(0).max(240).optional(),
  timezone: z.string().max(64).optional(),
  leadTimeHours: z.number().int().min(0).max(8760).optional(),
  maxAdvanceDays: z.number().int().min(1).max(730).optional(),
  meetingProvider: z.enum(["google_meet", "custom"]).optional(),
  meetingUrl: z.string().max(2000).nullable().optional(),
  visible: z.boolean().default(true),
});

const PatchSchema = CreateSchema.partial().extend({
  channelId: z.string().min(1),
  serviceId: z.string().min(1),
  active: z.boolean().optional(),
});

/**
 * The card's Visible/Activate toggles send nothing but a flag. Those must
 * still work on a 1:1 whose other fields are untouched, so they skip the
 * session rules entirely.
 */
function isFlagOnlyPatch(body: Record<string, unknown>): boolean {
  return Object.keys(body).every(
    (k) => body[k] === undefined || k === "visible" || k === "active" || k === "kind",
  );
}

/**
 * A 1:1 is a slot service by definition, always one slot per booking, and
 * its shape is checked by the same rules the editor shows the creator.
 */
function sessionProblem(input: {
  title?: string;
  description?: string;
  slotMinutes?: number | null;
  dailyStart?: string | null;
  dailyEnd?: string | null;
  rateCents?: number | null;
  meetingProvider?: string;
  meetingUrl?: string | null;
}): string | null {
  return validateSessionDraft({
    title: input.title ?? "",
    description: input.description ?? "",
    slotMinutes: input.slotMinutes ?? null,
    dailyStart: input.dailyStart ?? null,
    dailyEnd: input.dailyEnd ?? null,
    rateCents: input.rateCents ?? null,
    meetingProvider: input.meetingProvider ?? "google_meet",
    meetingUrl: input.meetingUrl ?? null,
  });
}

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

  const isSession = body.kind === "ONLINE";
  if (isSession) {
    const problem = sessionProblem(body);
    if (problem) return NextResponse.json({ error: problem }, { status: 422 });
  }

  const service = await db.bookableService.create({
    data: {
      channelId: body.channelId,
      kind: body.kind,
      title: body.title.trim(),
      category: body.category,
      description: body.description.trim(),
      rateCents: body.rateCents ?? null,
      // A 1:1's fee is per session, whatever the caller sent.
      rateUnit: isSession ? "session" : body.rateUnit,
      // A 1:1 is paid at booking, so its fee is never hidden.
      privateRate: isSession ? false : (body.privateRate ?? false),
      requirements: body.requirements?.trim() || null,
      availableDays: body.availableDays ?? [],
      durationMins: body.durationMins ?? null,
      extras: parseServiceExtras(body.extras) as unknown as Prisma.InputJsonValue,
      images: parseServiceImages(body.images) as unknown as Prisma.InputJsonValue,
      slotMinutes: body.slotMinutes ?? null,
      dailyStart: body.dailyStart ?? null,
      dailyEnd: body.dailyEnd ?? null,
      ...(body.bufferMins !== undefined ? { bufferMins: body.bufferMins } : {}),
      ...(body.timezone ? { timezone: body.timezone } : {}),
      ...(body.leadTimeHours !== undefined ? { leadTimeHours: body.leadTimeHours } : {}),
      ...(body.maxAdvanceDays !== undefined ? { maxAdvanceDays: body.maxAdvanceDays } : {}),
      visible: body.visible,
      // Session-only overrides, last so they win: one slot per booking, and
      // the session's length is its slot length.
      ...(isSession
        ? {
            minBookingSlots: 1,
            maxBookingSlots: 1,
            durationMins: body.slotMinutes ?? null,
            meetingProvider: body.meetingProvider ?? "google_meet",
            meetingUrl: body.meetingUrl?.trim() || null,
          }
        : {}),
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
  // A service never changes kind — the two flows differ too much for that
  // to mean anything sensible on rows already booked against it.
  if (body.kind !== undefined && body.kind !== service.kind) {
    return NextResponse.json(
      { error: "A booking can't switch between hire and 1:1 — create a new one." },
      { status: 422 },
    );
  }
  // Field edits are validated against the merged result, so a partial save
  // can't quietly leave a 1:1 unbookable.
  if (service.kind === "ONLINE" && !isFlagOnlyPatch(body)) {
    const problem = sessionProblem({
      title: body.title ?? service.title,
      description: body.description ?? service.description,
      slotMinutes: body.slotMinutes ?? service.slotMinutes,
      dailyStart: body.dailyStart ?? service.dailyStart,
      dailyEnd: body.dailyEnd ?? service.dailyEnd,
      rateCents: body.rateCents !== undefined ? body.rateCents : service.rateCents,
      meetingProvider: body.meetingProvider ?? service.meetingProvider,
      meetingUrl: body.meetingUrl !== undefined ? body.meetingUrl : service.meetingUrl,
    });
    if (problem) return NextResponse.json({ error: problem }, { status: 422 });
  }
  const updated = await db.bookableService.update({
    where: { id: serviceId },
    data: {
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.description !== undefined ? { description: body.description.trim() } : {}),
      ...(body.rateCents !== undefined ? { rateCents: body.rateCents } : {}),
      ...(body.rateUnit !== undefined ? { rateUnit: body.rateUnit } : {}),
      ...(body.privateRate !== undefined ? { privateRate: body.privateRate } : {}),
      ...(body.requirements !== undefined
        ? { requirements: body.requirements?.trim() || null }
        : {}),
      ...(body.availableDays !== undefined ? { availableDays: body.availableDays } : {}),
      ...(body.durationMins !== undefined ? { durationMins: body.durationMins } : {}),
      ...(body.extras !== undefined
        ? { extras: parseServiceExtras(body.extras) as unknown as Prisma.InputJsonValue }
        : {}),
      ...(body.images !== undefined
        ? { images: parseServiceImages(body.images) as unknown as Prisma.InputJsonValue }
        : {}),
      ...(body.slotMinutes !== undefined ? { slotMinutes: body.slotMinutes } : {}),
      ...(body.dailyStart !== undefined ? { dailyStart: body.dailyStart } : {}),
      ...(body.dailyEnd !== undefined ? { dailyEnd: body.dailyEnd } : {}),
      ...(body.bufferMins !== undefined ? { bufferMins: body.bufferMins } : {}),
      ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
      ...(body.leadTimeHours !== undefined ? { leadTimeHours: body.leadTimeHours } : {}),
      ...(body.maxAdvanceDays !== undefined ? { maxAdvanceDays: body.maxAdvanceDays } : {}),
      ...(body.meetingProvider !== undefined
        ? { meetingProvider: body.meetingProvider }
        : {}),
      ...(body.meetingUrl !== undefined
        ? { meetingUrl: body.meetingUrl?.trim() || null }
        : {}),
      ...(body.visible !== undefined ? { visible: body.visible } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
      ...(service.kind === "ONLINE"
        ? {
            minBookingSlots: 1,
            maxBookingSlots: 1,
            privateRate: false,
            ...(body.slotMinutes !== undefined ? { durationMins: body.slotMinutes } : {}),
          }
        : {}),
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
