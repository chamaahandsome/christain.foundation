import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getChannelAccess } from "@/lib/team-authorization";
import { DEFAULT_TEMPLATES } from "@/lib/default-templates";
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
  const access = await getChannelAccess(userId, channelId);
  if (!access.channel || !access.isOwner) notFound();

  // First visit: seed the default template library.
  const channel = await db.channel.findUniqueOrThrow({
    where: { id: channelId },
    select: {
      name: true,
      handle: true,
      bookingEnabled: true,
      businessInitializedAt: true,
      digitalSignature: true,
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
  }

  const [templates, contracts, bookings, services, quotes, invoices] =
    await Promise.all([
      db.businessTemplate.findMany({
        where: { channelId },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        select: { id: true, name: true, category: true, description: true, isDefault: true },
      }),
      db.contract.findMany({
        where: { channelId },
        orderBy: { updatedAt: "desc" },
        include: { activities: { orderBy: { createdAt: "desc" }, take: 1 } },
      }),
      db.bookingRequest.findMany({
        where: { channelId },
        orderBy: { createdAt: "desc" },
      }),
      db.bookableService.findMany({
        where: { channelId },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
      db.quote.findMany({ where: { channelId }, orderBy: { createdAt: "desc" } }),
      db.invoice.findMany({ where: { channelId }, orderBy: { createdAt: "desc" } }),
    ]);

  const strip = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  return (
    <BusinessDashboard
      channelId={channelId}
      channelName={channel.name}
      handle={channel.handle}
      bookingEnabled={channel.bookingEnabled}
      hasSignature={Boolean(channel.digitalSignature)}
      templates={templates}
      contracts={contracts.map((c) => ({
        id: c.id,
        contractNumber: c.contractNumber,
        title: c.title,
        clientName: c.clientName,
        status: c.status,
        preview: strip(c.content).slice(0, 160),
        signedAt: c.signedAt?.toLocaleDateString() ?? null,
        date: c.createdAt.toLocaleDateString(),
        lastActivity: c.activities[0]?.description ?? null,
      }))}
      services={services.map((s) => ({
        id: s.id,
        title: s.title,
        category: s.category,
        description: s.description,
        rateCents: s.rateCents,
        rateUnit: s.rateUnit,
        requirements: s.requirements,
        availableDays: (s.availableDays as string[] | null) ?? [],
        visible: s.visible,
        active: s.active,
      }))}
      bookings={bookings.map((b) => ({
        id: b.id,
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
        date: b.createdAt.toLocaleDateString(),
      }))}
      quotes={quotes.map((q) => ({
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
      }))}
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
