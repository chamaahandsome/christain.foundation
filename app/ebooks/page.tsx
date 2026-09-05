import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Books",
  description: "Books from the platform's teachers and authors — read in the protected reader.",
};

// The public book store (the Maltivas /ebooks browse): every published
// book across approved channels.
export default async function EbookStorePage() {
  const books = await db.ebook.findMany({
    where: { published: true, channel: { status: "APPROVED" } },
    orderBy: { createdAt: "desc" },
    include: { channel: { select: { name: true, handle: true } } },
    take: 60,
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        The bookshelf
      </p>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold">Books</h1>
        <Link
          href="/books"
          className="text-sm text-amber-700 hover:underline dark:text-amber-400"
        >
          My library →
        </Link>
      </div>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
        From the platform&apos;s teachers and authors — free previews for
        every book, read in the protected reader.
      </p>

      {books.length === 0 ? (
        <p className="mt-10 rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
          No books published yet. Check back soon.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          {books.map((b) => (
            <Link key={b.id} href={`/book/${b.id}`} className="group">
              <div className="aspect-[5/7] overflow-hidden rounded-xl bg-neutral-100 shadow-sm transition-transform group-hover:-translate-y-1 group-hover:shadow-md dark:bg-neutral-800">
                {b.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.coverImageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-amber-100 to-orange-100 text-4xl dark:from-amber-950 dark:to-orange-950">
                    📖
                  </div>
                )}
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-medium group-hover:text-amber-700 dark:group-hover:text-amber-400">
                {b.title}
              </p>
              <p className="text-xs text-neutral-500">
                {b.author ?? b.channel.name} ·{" "}
                {b.priceCents === 0 ? "Free" : `$${(b.priceCents / 100).toFixed(2)}`}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
