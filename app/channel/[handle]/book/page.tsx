import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { BookingForm } from "@/components/BookingForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Book" };

// Public booking page: invite the creator to speak, teach, or serve.
export default async function ChannelBookPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const channel = await db.channel.findUnique({
    where: { handle },
    select: { id: true, name: true, status: true, bookingEnabled: true },
  });
  if (!channel || channel.status !== "APPROVED" || !channel.bookingEnabled) notFound();

  const { userId } = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    ? await auth()
    : { userId: null };

  const services = await db.bookableService.findMany({
    where: { channelId: channel.id, visible: true, active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      category: true,
      description: true,
      rateCents: true,
      rateUnit: true,
      requirements: true,
      availableDays: true,
    },
  });

  return (
    <div className="mx-auto max-w-xl">
      <p className="text-sm leading-6 text-neutral-600 dark:text-neutral-400">
        Invite {channel.name} to speak, teach, lead worship, or serve at your
        gathering. Share the occasion and they&apos;ll come back to you — if
        it&apos;s a fit, the agreement is drafted and signed right here.
      </p>
      <div className="mt-6">
        <BookingForm
          channelId={channel.id}
          channelName={channel.name}
          signedIn={Boolean(userId)}
          services={services.map((s) => ({
            id: s.id,
            title: s.title,
            category: s.category,
            description: s.description,
            rateCents: s.rateCents,
            rateUnit: s.rateUnit,
            requirements: s.requirements,
            availableDays: (s.availableDays as string[] | null) ?? [],
          }))}
        />
      </div>
    </div>
  );
}
