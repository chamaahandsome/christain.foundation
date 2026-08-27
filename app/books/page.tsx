import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "My books" };

export default async function MyBooksPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) redirect("/");
  const { userId } = await auth();
  if (!userId) redirect("/signin");

  const purchases = await db.ebookPurchase.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      ebook: {
        select: {
          id: true,
          title: true,
          author: true,
          coverImageUrl: true,
          channel: { select: { name: true, handle: true } },
        },
      },
    },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        Your library
      </p>
      <h1 className="mt-2 text-2xl font-semibold">My books</h1>
      {purchases.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">
          Nothing here yet — books you get from creators appear here, ready to
          read.
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {purchases.map(({ ebook }) => (
            <li key={ebook.id}>
              <Link href={`/read/${ebook.id}`} className="group block">
                {ebook.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ebook.coverImageUrl}
                    alt=""
                    className="aspect-[5/7] w-full rounded-lg object-cover shadow-sm"
                  />
                ) : (
                  <div className="flex aspect-[5/7] w-full items-center justify-center rounded-lg bg-linear-to-br from-amber-500 to-orange-600 p-3 text-center text-sm font-semibold text-white shadow-sm">
                    {ebook.title}
                  </div>
                )}
                <p className="mt-2 line-clamp-2 text-sm font-medium group-hover:underline">
                  {ebook.title}
                </p>
                <p className="text-xs text-neutral-500">
                  {ebook.author ?? ebook.channel.name}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
