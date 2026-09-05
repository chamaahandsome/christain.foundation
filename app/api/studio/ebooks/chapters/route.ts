import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { nextChapterOrder } from "@/lib/ebooks";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";

// Chapter authoring — owner or library:manager on the book's channel.

async function gateByEbook(userId: string, ebookId: string) {
  const ebook = await db.ebook.findUnique({
    where: { id: ebookId },
    select: { id: true, channelId: true },
  });
  if (!ebook) return { error: "Book not found.", status: 404 } as const;
  const access = await getChannelAccess(
    userId,
    ebook.channelId,
    FEATURES.BOOKS,
    ACCESS_LEVELS.MANAGER,
  );
  if (!access.authorized) return { error: "Forbidden", status: 403 } as const;
  return { ebook } as const;
}

const CreateSchema = z.object({
  ebookId: z.string().min(1),
  title: z.string().min(1).max(300),
  htmlContent: z.string().max(2_000_000).optional(),
  freePreview: z.boolean().default(false),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const body = parsed.data;

  const gate = await gateByEbook(userId, body.ebookId);
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const existing = await db.ebookChapter.findMany({
    where: { ebookId: body.ebookId },
    select: { sortOrder: true },
  });
  const chapter = await db.ebookChapter.create({
    data: {
      ebookId: body.ebookId,
      sortOrder: nextChapterOrder(existing.map((c) => c.sortOrder)),
      title: body.title.trim(),
      htmlContent: body.htmlContent ?? null,
      freePreview: body.freePreview,
    },
  });
  return NextResponse.json({ chapter });
}

const UpdateSchema = z.object({
  chapterId: z.string().min(1),
  title: z.string().min(1).max(300).optional(),
  htmlContent: z.string().max(2_000_000).nullable().optional(),
  freePreview: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const body = parsed.data;

  const chapter = await db.ebookChapter.findUnique({
    where: { id: body.chapterId },
    select: { id: true, ebookId: true },
  });
  if (!chapter) return NextResponse.json({ error: "Chapter not found." }, { status: 404 });

  const gate = await gateByEbook(userId, chapter.ebookId);
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const updated = await db.ebookChapter.update({
    where: { id: chapter.id },
    data: {
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.htmlContent !== undefined ? { htmlContent: body.htmlContent } : {}),
      ...(body.freePreview !== undefined ? { freePreview: body.freePreview } : {}),
    },
  });
  return NextResponse.json({ chapter: updated });
}

const DeleteSchema = z.object({ chapterId: z.string().min(1) });

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = DeleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const chapter = await db.ebookChapter.findUnique({
    where: { id: parsed.data.chapterId },
    select: { id: true, ebookId: true },
  });
  if (!chapter) return NextResponse.json({ error: "Chapter not found." }, { status: 404 });

  const gate = await gateByEbook(userId, chapter.ebookId);
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  await db.ebookChapter.delete({ where: { id: chapter.id } });
  return NextResponse.json({ removed: true });
}
