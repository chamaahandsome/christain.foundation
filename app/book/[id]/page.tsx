import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { tricklEligibleForEbook } from "@/lib/ebooks";
import { BuyEbookButtons } from "@/components/BuyEbookButtons";

export const dynamic = "force-dynamic";

async function getBook(id: string) {
  return db.ebook.findUnique({
    where: { id },
    include: {
      channel: {
        select: {
          id: true,
          name: true,
          handle: true,
          status: true,
          ownerId: true,
          tricklProviderLinkCode: true,
        },
      },
      chapters: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, sortOrder: true, title: true, freePreview: true },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const book = await getBook(id).catch(() => null);
  if (!book || !book.published) return {};
  return {
    title: book.title,
    description: book.description?.slice(0, 160),
    openGraph: {
      title: book.title,
      description: book.description?.slice(0, 200),
      ...(book.coverImageUrl ? { images: [book.coverImageUrl] } : {}),
    },
  };
}

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ purchased?: string; trickl?: string }>;
}) {
  const { id } = await params;
  const { purchased: justPurchased, trickl: tricklStarted } = await searchParams;
  const book = await getBook(id).catch(() => null);
  if (!book || book.channel.status !== "APPROVED") notFound();

  const { userId } = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    ? await auth()
    : { userId: null };

  const isOwner = userId === book.channel.ownerId;
  if (!book.published && !isOwner) notFound();

  const purchase = userId
    ? await db.ebookPurchase.findUnique({
        where: { userId_ebookId: { userId, ebookId: book.id } },
        select: { id: true },
      })
    : null;
  const owned = Boolean(purchase) || isOwner || book.priceCents === 0;

  const tricklAvailable = tricklEligibleForEbook({
    priceCents: book.priceCents,
    channelTricklEnabled: Boolean(book.channel.tricklProviderLinkCode),
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        Book
      </p>
      <div className="mt-4 flex flex-col gap-6 sm:flex-row">
        {book.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.coverImageUrl}
            alt=""
            className="h-56 w-40 shrink-0 rounded-lg object-cover shadow-md"
          />
        ) : (
          <div className="flex h-56 w-40 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-amber-500 to-orange-600 p-4 text-center text-lg font-semibold text-white shadow-md">
            {book.title}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold">{book.title}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {book.author && <>{book.author} · </>}
            <Link href={`/@${book.channel.handle}`} className="underline">
              {book.channel.name}
            </Link>
          </p>
          {book.description && (
            <p className="mt-4 whitespace-pre-line text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              {book.description}
            </p>
          )}

          {justPurchased && (
            <p className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
              Thank you — the book is yours. It may take a few seconds to
              unlock while payment confirms.
            </p>
          )}
          {tricklStarted && (
            <p className="mt-4 rounded-xl border border-teal-200 bg-teal-50 p-3 text-sm text-teal-700 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-300">
              Your Trickl plan is running — the book unlocks automatically the
              moment your spare change covers it.
            </p>
          )}

          <div className="mt-5">
            <BuyEbookButtons
              ebookId={book.id}
              priceCents={book.priceCents}
              owned={owned}
              tricklAvailable={tricklAvailable}
              signedIn={Boolean(userId)}
            />
          </div>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Chapters
        </h2>
        <ol className="mt-3 space-y-1">
          {book.chapters.map((chapter) => {
            const readable = owned || chapter.freePreview;
            return (
              <li key={chapter.id}>
                {readable ? (
                  <Link
                    href={`/read/${book.id}?ch=${chapter.sortOrder}`}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-amber-50 dark:hover:bg-amber-950/30"
                  >
                    <span>
                      {chapter.sortOrder}. {chapter.title}
                    </span>
                    <span className="text-xs text-amber-700 dark:text-amber-400">
                      {owned ? "Read" : "Preview"}
                    </span>
                  </Link>
                ) : (
                  <span className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-neutral-400">
                    <span>
                      {chapter.sortOrder}. {chapter.title}
                    </span>
                    <span aria-hidden>🔒</span>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
