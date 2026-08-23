import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminUser } from "@/lib/admin";
import { db } from "@/lib/db";

// Editorial map placement (PLAN §3/§8: "build the tool, not a spreadsheet").
// Place library content onto topics, questions, or positions — exactly one
// target per placement (lib/map.ts rule, enforced here by construction).

export async function GET(req: Request) {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";

  const [items, topics, questions] = await Promise.all([
    db.contentItem.findMany({
      where: {
        youtubeVideoId: { not: null },
        ...(q ? { title: { contains: q } } : {}),
      },
      orderBy: { publishedAt: "desc" },
      take: 50,
      select: {
        id: true,
        title: true,
        youtubeVideoId: true,
        channel: { select: { handle: true } },
        placements: {
          select: {
            id: true,
            note: true,
            topic: { select: { name: true } },
            question: { select: { title: true } },
            position: {
              select: { name: true, question: { select: { title: true } } },
            },
          },
        },
      },
    }),
    db.topic.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    db.question.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        title: true,
        tier: true,
        positions: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, name: true },
        },
      },
    }),
  ]);

  return NextResponse.json({ items, topics, questions });
}

const CreateSchema = z.object({
  contentItemId: z.string().min(1),
  targetType: z.enum(["topic", "question", "position"]),
  targetId: z.string().min(1),
  note: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const body = parsed.data;

  const item = await db.contentItem.findUnique({
    where: { id: body.contentItemId },
    select: { id: true },
  });
  if (!item) {
    return NextResponse.json({ error: "Content not found." }, { status: 404 });
  }

  const target =
    body.targetType === "topic"
      ? await db.topic.findUnique({ where: { id: body.targetId }, select: { id: true } })
      : body.targetType === "question"
        ? await db.question.findUnique({ where: { id: body.targetId }, select: { id: true } })
        : await db.position.findUnique({ where: { id: body.targetId }, select: { id: true } });
  if (!target) {
    return NextResponse.json({ error: "Placement target not found." }, { status: 404 });
  }

  const targetField =
    body.targetType === "topic"
      ? { topicId: body.targetId }
      : body.targetType === "question"
        ? { questionId: body.targetId }
        : { positionId: body.targetId };

  const duplicate = await db.contentPlacement.findFirst({
    where: { contentItemId: item.id, ...targetField },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json({ error: "Already placed there." }, { status: 409 });
  }

  const placement = await db.contentPlacement.create({
    data: {
      contentItemId: item.id,
      ...targetField,
      note: body.note?.trim() || null,
    },
  });

  return NextResponse.json({ placement });
}

const DeleteSchema = z.object({ placementId: z.string().min(1) });

export async function DELETE(req: Request) {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = DeleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const existing = await db.contentPlacement.findUnique({
    where: { id: parsed.data.placementId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Placement not found." }, { status: 404 });
  }

  await db.contentPlacement.delete({ where: { id: existing.id } });
  return NextResponse.json({ removed: true });
}
