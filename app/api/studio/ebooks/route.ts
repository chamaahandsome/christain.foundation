import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { validateEbookInput } from "@/lib/ebooks";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";

// Ebook authoring — owner or library:manager. Publishing a PAID book
// additionally requires Stripe payouts (§9.4: no payouts, no revenue
// surfaces); free books publish without it.

async function requireLibraryManager(userId: string, channelId: string) {
  const access = await getChannelAccess(
    userId,
    channelId,
    FEATURES.LIBRARY,
    ACCESS_LEVELS.MANAGER,
  );
  if (!access.channel) return { error: "Channel not found", status: 404 } as const;
  if (!access.authorized) return { error: "Forbidden", status: 403 } as const;
  return { access } as const;
}

const CreateSchema = z.object({
  channelId: z.string().min(1),
  title: z.string().min(1).max(300),
  author: z.string().max(200).optional(),
  description: z.string().max(6000).optional(),
  coverImageUrl: z.string().url().max(500).optional(),
  priceCents: z.number().int().min(0),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const body = parsed.data;

  const gate = await requireLibraryManager(userId, body.channelId);
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const check = validateEbookInput(body);
  if (!check.ok) {
    return NextResponse.json({ error: "Invalid book", details: check.errors }, { status: 422 });
  }

  const ebook = await db.ebook.create({
    data: {
      channelId: body.channelId,
      title: body.title.trim(),
      author: body.author?.trim() || null,
      description: body.description?.trim() || null,
      coverImageUrl: body.coverImageUrl ?? null,
      priceCents: body.priceCents,
    },
  });
  return NextResponse.json({ ebook });
}

const UpdateSchema = z.object({
  ebookId: z.string().min(1),
  title: z.string().min(1).max(300).optional(),
  author: z.string().max(200).nullable().optional(),
  description: z.string().max(6000).nullable().optional(),
  coverImageUrl: z.string().url().max(500).nullable().optional(),
  priceCents: z.number().int().min(0).optional(),
  published: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const body = parsed.data;

  const ebook = await db.ebook.findUnique({
    where: { id: body.ebookId },
    select: {
      id: true,
      channelId: true,
      title: true,
      priceCents: true,
      _count: { select: { chapters: true } },
    },
  });
  if (!ebook) return NextResponse.json({ error: "Book not found." }, { status: 404 });

  const gate = await requireLibraryManager(userId, ebook.channelId);
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const nextTitle = body.title?.trim() ?? ebook.title;
  const nextPrice = body.priceCents ?? ebook.priceCents;
  const check = validateEbookInput({ title: nextTitle, priceCents: nextPrice });
  if (!check.ok) {
    return NextResponse.json({ error: "Invalid book", details: check.errors }, { status: 422 });
  }

  if (body.published === true) {
    if (ebook._count.chapters === 0) {
      return NextResponse.json(
        { error: "Add at least one chapter before publishing." },
        { status: 409 },
      );
    }
    if (nextPrice > 0) {
      const channel = await db.channel.findUniqueOrThrow({
        where: { id: ebook.channelId },
        select: { stripePayoutsEnabled: true },
      });
      if (!channel.stripePayoutsEnabled) {
        return NextResponse.json(
          { error: "Finish Stripe payouts setup before publishing a paid book (Payments tab)." },
          { status: 409 },
        );
      }
    }
  }

  const updated = await db.ebook.update({
    where: { id: ebook.id },
    data: {
      ...(body.title !== undefined ? { title: nextTitle } : {}),
      ...(body.author !== undefined ? { author: body.author?.trim() || null } : {}),
      ...(body.description !== undefined
        ? { description: body.description?.trim() || null }
        : {}),
      ...(body.coverImageUrl !== undefined ? { coverImageUrl: body.coverImageUrl } : {}),
      ...(body.priceCents !== undefined ? { priceCents: body.priceCents } : {}),
      ...(body.published !== undefined ? { published: body.published } : {}),
    },
  });
  return NextResponse.json({ ebook: updated });
}

const DeleteSchema = z.object({ ebookId: z.string().min(1) });

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = DeleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const ebook = await db.ebook.findUnique({
    where: { id: parsed.data.ebookId },
    select: { id: true, channelId: true, _count: { select: { purchases: true } } },
  });
  if (!ebook) return NextResponse.json({ error: "Book not found." }, { status: 404 });

  const gate = await requireLibraryManager(userId, ebook.channelId);
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  if (ebook._count.purchases > 0) {
    return NextResponse.json(
      { error: "This book has buyers — unpublish it instead of deleting." },
      { status: 409 },
    );
  }

  await db.ebookChapter.deleteMany({ where: { ebookId: ebook.id } });
  await db.ebook.delete({ where: { id: ebook.id } });
  return NextResponse.json({ removed: true });
}
