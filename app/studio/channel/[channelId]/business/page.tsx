import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getChannelAccess } from "@/lib/team-authorization";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { DEFAULT_TEMPLATES } from "@/lib/default-templates";
import { countSignatureFields } from "@/lib/contract-fields";
import { parseServiceExtras, parseServiceImages } from "@/lib/bookings";
import { formatMin } from "@/lib/availability";
import { BusinessDashboard } from "@/components/BusinessDashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Business" };

// Do-Biz: the business dashboard — Overview | Bookings | Quotes |
// Contracts | Invoices, mirroring the Maltivas layout on CF's design.
export default async function BusinessTab({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/signin");
  const { channelId } = await params;
  const access = await getChannelAccess(
    userId,
    channelId,
    FEATURES.BUSINESS,
    ACCESS_LEVELS.MANAGER,
  );
  if (!access.channel || !access.authorized) notFound();

  // First visit: seed the default template library.
  const channel = await db.channel.findUniqueOrThrow({
    where: { id: channelId },
    select: {
      name: true,
      handle: true,
      bookingEnabled: true,
      businessInitializedAt: true,
      digitalSignature: true,
      stripeAccountId: true,
      stripeChargesEnabled: true,
    },
  });
  if (!channel.businessInitializedAt) {
    await db.businessTemplate.createMany({
      data: DEFAULT_TEMPLATES.map((tpl) => ({
        channelId,
        name: tpl.name,
        category: tpl.category,
        description: tpl.description,
        content: tpl.content,
        fields: tpl.fields,
        isDefault: true,
      })),
    });
    await db.channel.update({
      where: { id: channelId },
      data: { businessInitializedAt: new Date() },
    });
  } else {
    // Keep the seeded library current: defaults are read-only (creator
    // saves become new rows), so upgraded bodies can replace them safely.
    const existing = await db.businessTemplate.findMany({
      where: { channelId, isDefault: true },
      select: { id: true, name: true, content: true },
    });
    for (const tpl of DEFAULT_TEMPLATES) {
      const match = existing.find((t) => t.name === tpl.name);
      if (!match) {
        await db.businessTemplate.create({
          data: {
            channelId,
            name: tpl.name,
            category: tpl.category,
            description: tpl.description,
            content: tpl.content,
            fields: tpl.fields,
            isDefault: true,
          },
        });
      } else if (match.content !== tpl.content) {
        await db.businessTemplate.update({
          where: { id: match.id },
          data: {
            content: tpl.content,
            category: tpl.category,
            description: tpl.description,
            fields: tpl.fields,
          },
        });
      }
    }
  }

  const [templates, contracts, bookings, serviceTitles, services, quotes, invoices] =
    await Promise.all([
      db.businessTemplate.findMany({
        where: { channelId },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        select: { id: true, name: true, category: true, description: true, isDefault: true },
      }),
      db.contract.findMany({
        where: { channelId },
        orderBy: { updatedAt: "desc" },
        include: {
          activities: { orderBy: { createdAt: "desc" }, take: 1 },
          signatures: { select: { signerRole: true, signedAt: true } },
        },
      }),
      db.bookingRequest.findMany({
        where: { channelId },
        orderBy: { createdAt: "desc" },
      }),
      db.bookableService.findMany({
        where: { channelId },
        select: { id: true, title: true },
      }),
      db.bookableService.findMany({
        where: { channelId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
      db.quote.findMany({ where: { channelId }, orderBy: { createdAt: "desc" } }),
      db.invoice.findMany({ where: { channelId }, orderBy: { createdAt: "desc" } }),
    ]);

  // Confirmed 1:1s per session, so the editor can refuse to delete one
  // people have already booked.
  const sessionRows = services.filter((s) => s.kind === "ONLINE");
  const bookedPerSession = new Map<string, number>();
  for (const b of bookings) {
    if (b.kind !== "ONLINE" || !b.serviceId) continue;
    if (!["CONFIRMED", "COMPLETED"].includes(b.status)) continue;
    bookedPerSession.set(b.serviceId, (bookedPerSession.get(b.serviceId) ?? 0) + 1);
  }

  const strip = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  return (
    <BusinessDashboard
      channelId={channelId}
      channelName={channel.name}
      handle={channel.handle}
      bookingEnabled={channel.bookingEnabled}
      hasSignature={Boolean(channel.digitalSignature)}
      templates={templates}
      contracts={contracts.map((c) => {
        const sigFields = countSignatureFields(c.content);
        // Chip-less documents still collect two signatures at send/sign.
        const sigTotal = Math.max(sigFields.creator + sigFields.client, 2);
        return {
          id: c.id,
          contractNumber: c.contractNumber,
          title: c.title,
          clientName: c.clientName,
          status: c.status,
          preview: strip(c.content).slice(0, 420),
          signedAt: c.signedAt?.toLocaleDateString() ?? null,
          date: c.createdAt.toLocaleDateString(),
          lastActivity: c.activities[0]?.description ?? null,
          sigSigned: c.signatures.filter((s) => s.signedAt).length,
          sigTotal,
        };
      })}
      canTakePayment={Boolean(channel.stripeAccountId && channel.stripeChargesEnabled)}
      sessions={sessionRows.map((s) => ({
        id: s.id,
        title: s.title,
        category: s.category,
        description: s.description,
        rateCents: s.rateCents,
        images: parseServiceImages(s.images),
        availableDays: (s.availableDays as string[] | null) ?? [],
        slotMinutes: s.slotMinutes,
        dailyStart: s.dailyStart,
        dailyEnd: s.dailyEnd,
        bufferMins: s.bufferMins,
        timezone: s.timezone,
        leadTimeHours: s.leadTimeHours,
        maxAdvanceDays: s.maxAdvanceDays,
        meetingProvider: s.meetingProvider,
        meetingUrl: s.meetingUrl,
        visible: s.visible,
        active: s.active,
        bookedCount: bookedPerSession.get(s.id) ?? 0,
      }))}
      services={services
        .filter((s) => s.kind !== "ONLINE")
        .map((s) => ({
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
        dailyStart: s.dailyStart,
        dailyEnd: s.dailyEnd,
        timezone: s.timezone,
        visible: s.visible,
        active: s.active,
        }))}
      bookings={bookings.map((b) => ({
        id: b.id,
        kind: b.kind,
        requesterName: b.requesterName,
        requesterEmail: b.requesterEmail,
        organization: b.organization,
        eventDate: b.eventDate?.toLocaleDateString() ?? null,
        location: b.location,
        budgetCents: b.budgetCents,
        message: b.message,
        status: b.status,
        decisionNote: b.decisionNote,
        contractId: b.contractId,
        serviceTitle:
          serviceTitles.find((s) => s.id === b.serviceId)?.title ?? null,
        extras: parseServiceExtras(b.selectedExtras),
        slotLabel: (() => {
          const picks = Array.isArray(b.slotSelections)
            ? (b.slotSelections as { date: string; startMin: number }[])
            : [];
          if (picks.length > 0) {
            const byDay = new Map<string, number[]>();
            for (const p of picks) {
              byDay.set(p.date, [...(byDay.get(p.date) ?? []), p.startMin]);
            }
            return [...byDay.entries()]
              .sort()
              .map(
                ([d, mins]) =>
                  `${new Date(`${d}T12:00:00Z`).toLocaleDateString()} ${formatMin(
                    Math.min(...mins),
                  )}${mins.length > 1 ? ` (${mins.length} slots)` : ""}`,
              )
              .join(" · ");
          }
          return b.slotStartMin !== null && b.eventDate
            ? `${b.eventDate.toLocaleDateString()} at ${formatMin(b.slotStartMin)}`
            : null;
        })(),
        date: b.createdAt.toLocaleDateString(),
        meetingUrl: b.meetingUrl,
        calendarHtmlLink: b.calendarHtmlLink,
        amountCents: b.amountCents,
        paymentStatus: b.paymentStatus,
      }))}
      quotes={quotes.map((q) => {
        const converted = invoices.find((inv) => inv.quoteId === q.id);
        return {
          id: q.id,
          quoteNumber: q.quoteNumber,
          title: q.title,
          clientName: q.clientName,
          clientEmail: q.clientEmail,
          amountCents: q.amountCents,
          status: q.status,
          token: q.token,
          date: q.createdAt.toLocaleDateString(),
          expiresAt: q.expiresAt?.toLocaleDateString() ?? null,
          invoiceId: converted?.id ?? null,
          invoiceStatus: converted?.status ?? null,
        };
      })}
      invoices={invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        title: inv.title,
        clientName: inv.clientName,
        clientEmail: inv.clientEmail,
        amountCents: inv.amountCents,
        status: inv.status,
        token: inv.token,
        date: inv.createdAt.toLocaleDateString(),
        dueAt: inv.dueAt?.toLocaleDateString() ?? null,
      }))}
    />
  );
}
