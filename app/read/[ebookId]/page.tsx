import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { canReadChapter } from "@/lib/ebooks";
import { sanitizeChapterHtml } from "@/lib/sanitize-html";
import { FEATURES } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";
import { ReaderShell } from "@/components/ReaderShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reader" };

// The protected reader: chapter HTML is sanitized server-side and rendered
// inside anti-copy chrome (watermark, no selection, no context menu). The
// content never exists as a downloadable file.
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
      channel: { select: { id: true, name: true, handle: true, status: true } },
      chapters: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!book || book.channel.status !== "APPROVED" || book.chapters.length === 0) {
    notFound();
  }

  let isStaff = false;
  if (userId) {
    const access = await getChannelAccess(userId, book.channel.id, FEATURES.LIBRARY);
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

  const readable = (chapter: (typeof book.chapters)[number]) =>
    canReadChapter({
      published: book.published,
      priceCents: book.priceCents,
      freePreview: chapter.freePreview,
      purchased: Boolean(purchase),
      isStaff,
    });

  const requested = ch ? Number(ch) : null;
  const chapter =
    (requested && book.chapters.find((c) => c.sortOrder === requested)) ||
    book.chapters.find(readable);
  if (!chapter) redirect(`/book/${book.id}`);
  if (!readable(chapter)) redirect(`/book/${book.id}`);

  const index = book.chapters.findIndex((c) => c.id === chapter.id);
  const prev = index > 0 ? book.chapters[index - 1] : null;
  const next = index + 1 < book.chapters.length ? book.chapters[index + 1] : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        <Link href={`/book/${book.id}`} className="hover:underline">
          {book.title}
        </Link>
      </p>
      <h1 className="mt-2 text-2xl font-semibold">
        {chapter.sortOrder}. {chapter.title}
      </h1>

      <ReaderShell watermark={user?.email ?? "preview"}>
        <div
          className="prose-reader mt-6 text-[15px] leading-7"
          // Sanitized server-side (lib/sanitize-html) — no active content.
          dangerouslySetInnerHTML={{
            __html: sanitizeChapterHtml(chapter.htmlContent ?? "<p>(empty chapter)</p>"),
          }}
        />
      </ReaderShell>

      <nav className="mt-10 flex items-center justify-between gap-3 border-t border-neutral-200 pt-5 dark:border-neutral-800">
        {prev && readable(prev) ? (
          <Link
            href={`/read/${book.id}?ch=${prev.sortOrder}`}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:border-amber-500 hover:bg-amber-50 dark:border-neutral-700 dark:hover:border-amber-600 dark:hover:bg-amber-950/40"
          >
            ← {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next &&
          (readable(next) ? (
            <Link
              href={`/read/${book.id}?ch=${next.sortOrder}`}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:border-amber-500 hover:bg-amber-50 dark:border-neutral-700 dark:hover:border-amber-600 dark:hover:bg-amber-950/40"
            >
              {next.title} →
            </Link>
          ) : (
            <Link
              href={`/book/${book.id}`}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
            >
              Unlock the rest →
            </Link>
          ))}
      </nav>
    </main>
  );
}
