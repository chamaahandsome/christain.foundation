import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";
import { BooksManager } from "@/components/BooksManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Books" };

// Ebook authoring (first purchasable). Chapters are written here — HTML in
// the database, read through the protected reader, never a downloadable file.
export default async function BooksTab({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/signin");

  const { channelId } = await params;
  const access = await getChannelAccess(userId, channelId, FEATURES.LIBRARY);
  if (!access.channel || !access.authorized) notFound();

  const canEdit =
    access.isOwner ||
    (access.featureAccess[FEATURES.LIBRARY] ?? "none") === ACCESS_LEVELS.MANAGER;

  const [ebooks, channel] = await Promise.all([
    db.ebook.findMany({
      where: { channelId },
      orderBy: { createdAt: "desc" },
      include: {
        chapters: {
          orderBy: { sortOrder: "asc" },
          select: { id: true, sortOrder: true, title: true, freePreview: true },
        },
        _count: { select: { purchases: true } },
      },
    }),
    db.channel.findUniqueOrThrow({
      where: { id: channelId },
      select: { stripePayoutsEnabled: true },
    }),
  ]);

  return (
    <section className="mt-6">
      <p className="text-sm text-neutral-500">
        Write chapters here; readers get them through the protected reader.
        Free books publish any time; paid books need Stripe payouts ready.
      </p>
      <BooksManager
        channelId={channelId}
        canEdit={canEdit}
        payoutsReady={channel.stripePayoutsEnabled}
        initialBooks={ebooks.map((ebook) => ({
          id: ebook.id,
          title: ebook.title,
          author: ebook.author,
          coverImageUrl: ebook.coverImageUrl,
          priceCents: ebook.priceCents,
          published: ebook.published,
          purchases: ebook._count.purchases,
          chapters: ebook.chapters,
        }))}
      />
    </section>
  );
}
