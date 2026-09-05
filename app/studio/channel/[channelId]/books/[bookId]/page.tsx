import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { FEATURES } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";
import { BookStudio } from "@/components/BookStudio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Book" };

export default async function BookWorkspace({
  params,
}: {
  params: Promise<{ channelId: string; bookId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/signin");
  const { channelId, bookId } = await params;
  const access = await getChannelAccess(userId, channelId, FEATURES.BOOKS);
  if (!access.channel || !access.authorized) notFound();

  const [book, channel] = await Promise.all([
    db.ebook.findUnique({
      where: { id: bookId },
      include: {
        chapters: { orderBy: { sortOrder: "asc" } },
        _count: { select: { purchases: true } },
      },
    }),
    db.channel.findUniqueOrThrow({
      where: { id: channelId },
      select: { stripeChargesEnabled: true, stripePayoutsEnabled: true },
    }),
  ]);
  if (!book || book.channelId !== channelId) notFound();

  return (
    <BookStudio
      channelId={channelId}
      payoutsReady={channel.stripeChargesEnabled && channel.stripePayoutsEnabled}
      book={{
        id: book.id,
        title: book.title,
        author: book.author,
        description: book.description,
        coverImageUrl: book.coverImageUrl,
        priceCents: book.priceCents,
        published: book.published,
        purchases: book._count.purchases,
        chapters: book.chapters.map((c) => ({
          id: c.id,
          sortOrder: c.sortOrder,
          title: c.title,
          htmlContent: c.htmlContent ?? "",
          freePreview: c.freePreview,
        })),
      }}
    />
  );
}
