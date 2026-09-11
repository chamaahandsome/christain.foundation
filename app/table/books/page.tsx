import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { myBooks } from "@/lib/table-queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your eBooks" };

// The shelf: every book bought, opening straight into the reader.
export default async function BooksRoom() {
  const { userId } = await auth();
  if (!userId) redirect("/signin?redirect_url=/table/books");
  const books = await myBooks(userId);

  return (
    <div className="py-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        Your table
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Your eBooks</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Yours to read, whenever you sit down with them.
      </p>

      {books.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
          <p className="text-4xl">📖</p>
          <p className="mt-3 font-medium">No books yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
            Books you get from creators land here, ready to read — the first
            chapters are usually free.
          </p>
          <Link
            href="/ebooks"
            className="mt-4 inline-block text-sm text-amber-700 hover:underline dark:text-amber-400"
          >
            Browse the store →
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          {books.map((book) => (
            <li key={book.id}>
              <Link href={`/read/${book.id}`} className="group block">
                {book.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={book.coverImageUrl}
                    alt=""
                    className="aspect-[5/7] w-full rounded-lg object-cover shadow-sm transition-transform duration-200 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex aspect-[5/7] w-full items-center justify-center rounded-lg bg-linear-to-br from-amber-500 to-orange-600 p-3 text-center text-sm font-semibold text-white shadow-sm transition-transform duration-200 group-hover:scale-[1.03]">
                    {book.title}
                  </div>
                )}
                <p className="mt-2 line-clamp-2 text-sm font-medium group-hover:underline">
                  {book.title}
                </p>
                <p className="text-xs text-neutral-500">
                  {book.author ?? book.channel.name}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
