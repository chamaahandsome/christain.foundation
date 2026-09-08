import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { ServiceBookingClient } from "@/components/ServiceBookingClient";
import { SessionBookingClient } from "@/components/SessionBookingClient";
import { parseServiceExtras, parseServiceImages } from "@/lib/bookings";

export const dynamic = "force-dynamic";

// One service's booking page: date, times, details — the flow a visitor
// walks after choosing a card on /@handle/book.
export default async function ServiceBookingPage({
  params,
}: {
  params: Promise<{ handle: string; serviceId: string }>;
}) {
  const { handle, serviceId } = await params;
  const channel = await db.channel.findUnique({
    where: { handle },
    select: { id: true, name: true, status: true, bookingEnabled: true },
  });
  if (!channel || channel.status !== "APPROVED" || !channel.bookingEnabled) {
    notFound();
  }

  const service = await db.bookableService.findFirst({
    where: {
      id: serviceId,
      channelId: channel.id,
      visible: true,
      active: true,
    },
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
      minBookingSlots: true,
      maxBookingSlots: true,
      meetingProvider: true,
    },
  });
  if (!service) notFound();

  // An online 1:1 books itself: day, time, pay if there's a fee, done.
  if (service.kind === "ONLINE") {
    return (
      <div>
        <Link
          href={`/@${handle}/book`}
          className="text-xs text-neutral-500 hover:text-amber-700 dark:hover:text-amber-400"
        >
          ← Everything {channel.name} offers
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
          {service.title}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
          {service.description}
        </p>
        <div className="mt-8">
          <SessionBookingClient
            channelId={channel.id}
            channelName={channel.name}
            handle={handle}
            session={{
              id: service.id,
              title: service.title,
              category: service.category,
              description: service.description,
              rateCents: service.rateCents,
              slotMinutes: service.slotMinutes,
              timezone: service.timezone,
              images: parseServiceImages(service.images),
              availableDays: (service.availableDays as string[] | null) ?? [],
              meetingProvider: service.meetingProvider,
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link
        href={`/@${handle}/book`}
        className="text-xs text-neutral-500 hover:text-amber-700 dark:hover:text-amber-400"
      >
        ← All services
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">
        {service.title}
      </h1>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
        {service.description}
      </p>

      <div className="mt-8">
        <ServiceBookingClient
          channelId={channel.id}
          channelName={channel.name}
          handle={handle}
          service={{
            id: service.id,
            title: service.title,
            category: service.category,
            description: service.description,
            rateCents: service.rateCents,
            rateUnit: service.rateUnit,
            privateRate: service.privateRate,
            requirements: service.requirements,
            availableDays: (service.availableDays as string[] | null) ?? [],
            durationMins: service.durationMins,
            extras: parseServiceExtras(service.extras),
            images: parseServiceImages(service.images),
            slotMinutes: service.slotMinutes,
            timezone: service.timezone,
            minBookingSlots: service.minBookingSlots,
            maxBookingSlots: service.maxBookingSlots,
          }}
        />
      </div>
    </div>
  );
}
