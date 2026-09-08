import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { BookCard } from "@/components/BookCard";

// ISR (SCALABILITY §3.1): same page for everyone — CDN-cached, re-rendered at most
// once per 60s, so origin load scales with content changes, not traffic.
export const revalidate = 60;

// Books tab: every published book, storefront-style.
export default async function ChannelBooksPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const channel = await db.channel.findUnique({
    where: { handle },
    select: { id: true, status: true },
  });
  if (!channel || channel.status !== "APPROVED") notFound();

  const books = await db.ebook.findMany({
    where: { channelId: channel.id, published: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      author: true,
      coverImageUrl: true,
      priceCents: true,
      _count: { select: { chapters: true } },
    },
  });

  if (books.length === 0) {
    return <p className="text-sm text-neutral-500">No books yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 lg:grid-cols-6">
      {books.map((book) => (
        <BookCard key={book.id} book={book} />
      ))}
    </div>
  );
}
