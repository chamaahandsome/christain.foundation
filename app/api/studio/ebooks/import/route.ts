import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  isEpubBuffer,
  isPdfBuffer,
  parseEpubBuffer,
  parsePdfBuffer,
} from "@/lib/book-import";
import { db } from "@/lib/db";
import { nextChapterOrder } from "@/lib/ebooks";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";

// Whole-book import (the Maltivas parse-book flow, minus the S3 hop): the
// EPUB/PDF is parsed in memory into chapters and discarded — nothing is
// stored as a file, anywhere.

export const maxDuration = 60; // parsing a large PDF takes a moment

const MAX_FILE_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const ebookId = form?.get("ebookId");
  const file = form?.get("file");
  if (typeof ebookId !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "ebookId and file are required." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File is over the 25MB limit." }, { status: 413 });
  }

  const ebook = await db.ebook.findUnique({
    where: { id: ebookId },
    select: { id: true, channelId: true, author: true, description: true },
  });
  if (!ebook) return NextResponse.json({ error: "Book not found." }, { status: 404 });

  const access = await getChannelAccess(
    userId,
    ebook.channelId,
    FEATURES.BOOKS,
    ACCESS_LEVELS.MANAGER,
  );
  if (!access.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let parsed;
  try {
    if (isPdfBuffer(buffer)) {
      parsed = await parsePdfBuffer(buffer);
    } else if (isEpubBuffer(buffer)) {
      parsed = await parseEpubBuffer(buffer);
    } else {
      return NextResponse.json(
        { error: "Unsupported file — upload an .epub or .pdf." },
        { status: 422 },
      );
    }
  } catch (err) {
    console.error("book import parse failed", err);
    return NextResponse.json(
      { error: "Could not parse that file. Is it a valid EPUB/PDF?" },
      { status: 422 },
    );
  }

  if (parsed.chapters.length === 0) {
    return NextResponse.json(
      { error: "No readable chapters found in the file." },
      { status: 422 },
    );
  }

  const existing = await db.ebookChapter.findMany({
    where: { ebookId: ebook.id },
    select: { sortOrder: true },
  });
  const base = nextChapterOrder(existing.map((c) => c.sortOrder)) - 1;

  await db.ebookChapter.createMany({
    data: parsed.chapters.map((chapter) => ({
      ebookId: ebook.id,
      sortOrder: base + chapter.chapterNumber,
      title: chapter.title.slice(0, 300),
      htmlContent: chapter.content,
    })),
  });

  // Fill empty book metadata from the file's own.
  await db.ebook.update({
    where: { id: ebook.id },
    data: {
      ...(!ebook.author && parsed.metadata.author
        ? { author: parsed.metadata.author.slice(0, 120) }
        : {}),
      ...(!ebook.description && parsed.metadata.description
        ? { description: parsed.metadata.description.slice(0, 5000) }
        : {}),
    },
  });

  return NextResponse.json({ imported: parsed.chapters.length });
}
