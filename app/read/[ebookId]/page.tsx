import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { canReadChapter, tricklEligibleForEbook } from "@/lib/ebooks";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { FEATURES } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";
import { EbookReader } from "@/components/EbookReader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reader" };

// The reader (the Maltivas EBookReader experience over chapters-in-DB):
// TOC, keyboard nav, typography settings, watermark — and the inline
// paywall when a free preview runs out. Locked chapters never leave the
// server; the content never exists as a downloadable file.
export default async function ReaderPage({
  params,
  searchParams,
}: {
  params: Promise<{ ebookId: string }>;
  searchParams: Promise<{ ch?: string }>;
}) {
  const { ebookId } = await params;
  const { ch } = await searchParams;

  const { userId } = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    ? await auth()
    : { userId: null };

  const book = await db.ebook.findUnique({
    where: { id: ebookId },
    include: {
      channel: {
        select: {
          id: true,
          name: true,
          handle: true,
          status: true,
          tricklProviderLinkCode: true,
        },
      },
      chapters: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!book || book.channel.status !== "APPROVED" || book.chapters.length === 0) {
    notFound();
  }

  let isStaff = false;
  if (userId) {
    const access = await getChannelAccess(userId, book.channel.id, FEATURES.BOOKS);
    isStaff = access.isOwner || access.authorized;
  }
  const purchase = userId
    ? await db.ebookPurchase.findUnique({
        where: { userId_ebookId: { userId, ebookId: book.id } },
        select: { id: true },
      })
    : null;
  const user = userId
    ? await db.user.findUnique({ where: { id: userId }, select: { email: true } })
    : null;

  const owned = Boolean(purchase) || isStaff || book.priceCents === 0;
  // Imported EPUBs carry internal cross-links (href="ch04.xhtml") that
  // would navigate the reader to /read/<file> and 404. Anything that isn't
  // a real web link loses its href and renders inert.
  const neutralizeInternalLinks = (html: string) =>
    html.replace(/(<a\b[^>]*?)\s+href\s*=\s*(?:"(?!https?:\/\/)[^"]*"|'(?!https?:\/\/)[^']*')/gi, "$1");
  const chapters = book.chapters.map((chapter) => {
    const readable = canReadChapter({
      published: book.published,
      priceCents: book.priceCents,
      freePreview: chapter.freePreview,
      purchased: Boolean(purchase),
      isStaff,
    });
    return {
      sortOrder: chapter.sortOrder,
      title: chapter.title,
      readable,
      freePreview: chapter.freePreview,
      // Locked chapters never ship their HTML to the client.
      html: readable
        ? neutralizeInternalLinks(sanitizeRichHtml(chapter.htmlContent ?? ""))
        : null,
    };
  });
  if (!chapters.some((c) => c.readable)) notFound();

  const requested = ch ? Number(ch) : null;
  const initial =
    (requested && chapters.find((c) => c.sortOrder === requested)?.sortOrder) ||
    chapters.find((c) => c.readable)!.sortOrder;

  return (
    <EbookReader
      bookId={book.id}
      title={book.title}
      author={book.author}
      channelName={book.channel.name}
      chapters={chapters}
      initialChapter={initial}
      watermark={user?.email ?? "Christian Foundation"}
      priceCents={book.priceCents}
      owned={owned}
      tricklAvailable={tricklEligibleForEbook({
        priceCents: book.priceCents,
        channelTricklEnabled: Boolean(book.channel.tricklProviderLinkCode),
      })}
      signedIn={Boolean(userId)}
    />
  );
}
