import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { BookingForm } from "@/components/BookingForm";
import { ServiceCatalog } from "@/components/ServiceCatalog";
import { parseServiceExtras, parseServiceImages } from "@/lib/bookings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Book" };

// Public booking page, in two halves. Online 1:1s come first because they
// need nothing from the visitor but a time — book, pay if there's a fee,
// done. Hire services follow: a request that becomes a quote and an
// agreement. Channels with neither still take a plain request through the
// general form.
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

  const services = await db.bookableService.findMany({
    where: { channelId: channel.id, visible: true, active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      kind: true,
      title: true,
      category: true,
      description: true,
      rateCents: true,
      rateUnit: true,
      privateRate: true,
      requirements: true,
      availableDays: true,
      durationMins: true,
      extras: true,
      images: true,
      slotMinutes: true,
      timezone: true,
    },
  });

  const view = services.map((s) => ({
    id: s.id,
    title: s.title,
    category: s.category,
    description: s.description,
    rateCents: s.rateCents,
    rateUnit: s.rateUnit,
    privateRate: s.privateRate,
    requirements: s.requirements,
    availableDays: (s.availableDays as string[] | null) ?? [],
    durationMins: s.durationMins,
    extras: parseServiceExtras(s.extras),
    images: parseServiceImages(s.images),
    slotMinutes: s.slotMinutes,
    timezone: s.timezone,
  }));
  const sessions = view.filter(
    (_, i) => services[i].kind === "ONLINE",
  );
  const hires = view.filter((_, i) => services[i].kind !== "ONLINE");

  return (
    <div className={services.length > 0 ? "" : "mx-auto max-w-xl"}>
      <p className="max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
        {sessions.length > 0 && hires.length > 0
          ? `Book time with ${channel.name} one to one, or invite them to speak, teach, lead worship, or serve at your gathering.`
          : sessions.length > 0
            ? `Book time with ${channel.name} one to one — pick a slot and you'll have the meeting link straight away.`
            : hires.length > 0
              ? `Invite ${channel.name} to speak, teach, lead worship, or serve at your gathering. Choose what you're booking and pick your dates — if it's a fit, the agreement is drafted and signed right here.`
              : `Invite ${channel.name} to speak, teach, lead worship, or serve at your gathering. Share the occasion and they'll come back to you — if it's a fit, the agreement is drafted and signed right here.`}
      </p>

      {sessions.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold tracking-tight">One to one</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Pick a time — no back and forth. You&apos;ll get a calendar invite
            and a meeting link.
          </p>
          <div className="mt-4">
            <ServiceCatalog handle={handle} services={sessions} />
          </div>
        </section>
      )}

      {hires.length > 0 && (
        <section className="mt-10">
          {sessions.length > 0 && (
            <>
              <h2 className="text-lg font-bold tracking-tight">Hire {channel.name}</h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                For an event or engagement — send the details and they&apos;ll
                come back to you.
              </p>
            </>
          )}
          <div className={sessions.length > 0 ? "mt-4" : "mt-6"}>
            <ServiceCatalog handle={handle} services={hires} />
          </div>
        </section>
      )}

      {services.length === 0 && (
        <div className="mt-6">
          <BookingForm
            channelId={channel.id}
            channelName={channel.name}
            services={[]}
          />
        </div>
      )}
    </div>
  );
}
