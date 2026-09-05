import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getChannelAccess } from "@/lib/team-authorization";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { parseLineItems } from "@/lib/billing";
import { BillingEditor } from "@/components/BillingEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoice" };

export default async function InvoiceEditorPage({
  params,
}: {
  params: Promise<{ channelId: string; invoiceId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/signin");
  const { channelId, invoiceId } = await params;
  const access = await getChannelAccess(
    userId,
    channelId,
    FEATURES.BUSINESS,
    ACCESS_LEVELS.MANAGER,
  );
  if (!access.channel || !access.authorized) notFound();

  const [channel, invoice] = await Promise.all([
    db.channel.findUniqueOrThrow({
      where: { id: channelId },
      select: {
      name: true,
      businessLogoUrl: true,
      businessLogoHistory: true,
      businessEmail: true,
      businessAddress: true,
    },
    }),
    db.invoice.findUnique({ where: { id: invoiceId } }),
  ]);
  if (!invoice || invoice.channelId !== channelId) notFound();

  return (
    <BillingEditor
      kind="invoice"
      channelId={channelId}
      channelName={channel.name}
      logoUrl={channel.businessLogoUrl}
      logoHistory={
        Array.isArray(channel.businessLogoHistory)
          ? (channel.businessLogoHistory as string[]).filter(
              (u): u is string => typeof u === "string",
            )
          : []
      }
      companyEmail={channel.businessEmail ?? ""}
      companyAddress={channel.businessAddress ?? ""}
      initial={{
        id: invoice.id,
        number: invoice.invoiceNumber,
        clientName: invoice.clientName,
        clientEmail: invoice.clientEmail,
        title: invoice.title,
        lineItems:
          parseLineItems(invoice.lineItems).length > 0
            ? parseLineItems(invoice.lineItems)
            : [
                {
                  item: invoice.title,
                  details: "",
                  qty: 1,
                  rateCents: invoice.amountCents,
                },
              ],
        taxBps: invoice.taxBps,
        discountCents: invoice.discountCents,
        paymentTerms: invoice.paymentTerms,
        validDays: 30,
        notes: invoice.notes ?? "",
        terms: invoice.terms ?? "",
        status: invoice.status,
      }}
    />
  );
}
