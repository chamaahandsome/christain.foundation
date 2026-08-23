import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminUser } from "@/lib/admin";
import { db } from "@/lib/db";

// Editorial shelves — the hand-curated rows on explore (and, later, home).

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function GET() {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const shelves = await db.shelf.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          contentItem: {
            select: { id: true, title: true, channel: { select: { handle: true } } },
          },
        },
      },
    },
  });

  return NextResponse.json({ shelves });
}

const PostSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_shelf"), title: z.string().min(2).max(120) }),
  z.object({
    action: z.literal("add_item"),
    shelfId: z.string().min(1),
    contentItemId: z.string().min(1),
  }),
]);

export async function POST(req: Request) {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = PostSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const body = parsed.data;

  if (body.action === "create_shelf") {
    const slug = slugify(body.title);
    if (slug.length < 2) {
      return NextResponse.json({ error: "Title yields an empty slug." }, { status: 422 });
    }
    const taken = await db.shelf.findUnique({ where: { slug }, select: { id: true } });
    if (taken) {
      return NextResponse.json({ error: "A shelf with that title exists." }, { status: 409 });
    }
    const last = await db.shelf.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const shelf = await db.shelf.create({
      data: { slug, title: body.title.trim(), sortOrder: (last?.sortOrder ?? 0) + 1 },
    });
    return NextResponse.json({ shelf });
  }

  // add_item
  const [shelf, item] = await Promise.all([
    db.shelf.findUnique({ where: { id: body.shelfId }, select: { id: true } }),
    db.contentItem.findUnique({
      where: { id: body.contentItemId },
      select: { id: true },
    }),
  ]);
  if (!shelf || !item) {
    return NextResponse.json({ error: "Shelf or content not found." }, { status: 404 });
  }
  const duplicate = await db.shelfItem.findFirst({
    where: { shelfId: shelf.id, contentItemId: item.id },
    select: { id: true },
  });
  if (duplicate) {
    return NextResponse.json({ error: "Already on this shelf." }, { status: 409 });
  }
  const lastItem = await db.shelfItem.findFirst({
    where: { shelfId: shelf.id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const shelfItem = await db.shelfItem.create({
    data: {
      shelfId: shelf.id,
      contentItemId: item.id,
      sortOrder: (lastItem?.sortOrder ?? 0) + 1,
    },
  });
  return NextResponse.json({ shelfItem });
}

const PatchSchema = z.object({
  shelfId: z.string().min(1),
  published: z.boolean().optional(),
  title: z.string().min(2).max(120).optional(),
  sortOrder: z.number().int().min(0).max(1000).optional(),
});

export async function PATCH(req: Request) {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const body = parsed.data;

  const existing = await db.shelf.findUnique({
    where: { id: body.shelfId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Shelf not found." }, { status: 404 });
  }

  const shelf = await db.shelf.update({
    where: { id: existing.id },
    data: {
      ...(body.published !== undefined ? { published: body.published } : {}),
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
    },
  });
  return NextResponse.json({ shelf });
}

const DeleteSchema = z.union([
  z.object({ shelfId: z.string().min(1) }),
  z.object({ shelfItemId: z.string().min(1) }),
]);

export async function DELETE(req: Request) {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = DeleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if ("shelfItemId" in parsed.data) {
    const item = await db.shelfItem.findUnique({
      where: { id: parsed.data.shelfItemId },
      select: { id: true },
    });
    if (!item) return NextResponse.json({ error: "Not found." }, { status: 404 });
    await db.shelfItem.delete({ where: { id: item.id } });
    return NextResponse.json({ removed: true });
  }

  const shelf = await db.shelf.findUnique({
    where: { id: parsed.data.shelfId },
    select: { id: true },
  });
  if (!shelf) return NextResponse.json({ error: "Not found." }, { status: 404 });
  await db.shelfItem.deleteMany({ where: { shelfId: shelf.id } });
  await db.shelf.delete({ where: { id: shelf.id } });
  return NextResponse.json({ removed: true });
}
