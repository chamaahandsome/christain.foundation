import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";

export const dynamic = "force-dynamic";
export const metadata = { title: "Books" };

// The books grid (the Maltivas creator ebooks list): covers, status,
// sales — each opens its workspace.
export default async function BooksTab({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/signin");
  const { channelId } = await params;
  const access = await getChannelAccess(userId, channelId, FEATURES.BOOKS);
  if (!access.channel || !access.authorized) notFound();

  const canEdit =
    access.isOwner ||
    (access.featureAccess[FEATURES.BOOKS] ?? "none") === ACCESS_LEVELS.MANAGER;

  const books = await db.ebook.findMany({
    where: { channelId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { purchases: true, chapters: true } } },
  });

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Books</h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            Chapters live in the protected reader — never a downloadable file.
          </p>
        </div>
        {canEdit && (
          <Link
            href={`/studio/channel/${channelId}/books/new`}
            className="rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500"
          >
            📖 New book
          </Link>
        )}
      </div>

      {books.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
          No books yet — write one chapter by chapter, or import an EPUB/PDF.
        </p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {books.map((b) => (
            <Link
              key={b.id}
              href={`/studio/channel/${channelId}/books/${b.id}`}
              className="group overflow-hidden rounded-2xl border border-neutral-200 transition-all hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md dark:border-neutral-800 dark:hover:border-amber-600"
            >
              <div className="relative aspect-[5/7] bg-neutral-100 dark:bg-neutral-800">
                {b.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.coverImageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-amber-100 to-orange-100 text-4xl dark:from-amber-950 dark:to-orange-950">
                    📖
                  </div>
                )}
                <span
                  className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                    b.published
                      ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                      : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                  }`}
                >
                  {b.published ? "live" : "draft"}
                </span>
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-medium group-hover:text-amber-700 dark:group-hover:text-amber-400">
                  {b.title}
                </p>
                <p className="text-xs text-neutral-500">
                  {b.priceCents === 0 ? "Free" : `$${(b.priceCents / 100).toFixed(2)}`}
                  {" · "}
                  {b._count.chapters} ch · {b._count.purchases} sold
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
