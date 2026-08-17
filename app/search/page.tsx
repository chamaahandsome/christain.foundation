import Link from "next/link";
import { Visibility } from "@prisma/client";
import { db } from "@/lib/db";
import { thumbnailUrl } from "@/lib/youtube";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search" };

// Simple contains-search for now; moves to MySQL FULLTEXT (title, searchText
// from transcripts) once the catalog justifies it — see PLAN.md.
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const results = query
    ? await db.contentItem
        .findMany({
          where: {
            visibility: Visibility.PUBLIC,
            youtubeVideoId: { not: null },
            channel: { status: "APPROVED" },
            OR: [
              { title: { contains: query } },
              { description: { contains: query } },
              { searchText: { contains: query } },
            ],
          },
          orderBy: { publishedAt: "desc" },
          take: 40,
          select: {
            id: true,
            title: true,
            youtubeVideoId: true,
            channel: { select: { name: true, handle: true } },
          },
        })
        .catch(() => [])
    : [];

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <form action="/search" className="mb-8">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search teaching, sermons, topics…"
          className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-base outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-amber-600"
        />
      </form>

      {query && (
        <p className="mb-4 text-sm text-neutral-500">
          {results.length} result{results.length === 1 ? "" : "s"} for “{query}”
        </p>
      )}

      <ul className="space-y-4">
        {results.map((item) => (
          <li key={item.id}>
            <Link href={`/watch/${item.id}`} className="group flex gap-4">
              {item.youtubeVideoId && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbnailUrl(item.youtubeVideoId, "mqdefault")}
                  alt=""
                  className="h-20 w-36 shrink-0 rounded-lg object-cover"
                />
              )}
              <div>
                <p className="line-clamp-2 font-medium group-hover:underline">
                  {item.title}
                </p>
                <p className="mt-1 text-sm text-neutral-500">{item.channel.name}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
