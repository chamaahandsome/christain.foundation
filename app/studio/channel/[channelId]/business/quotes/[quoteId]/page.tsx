import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getChannelAccess } from "@/lib/team-authorization";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { parseLineItems } from "@/lib/billing";
import { BillingEditor } from "@/components/BillingEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quote" };

export default async function QuoteEditorPage({
  params,
}: {
  params: Promise<{ channelId: string; quoteId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/signin");
  const { channelId, quoteId } = await params;
  const access = await getChannelAccess(
    userId,
    channelId,
    FEATURES.BUSINESS,
    ACCESS_LEVELS.MANAGER,
  );
  if (!access.channel || !access.authorized) notFound();

  const [channel, quote] = await Promise.all([
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
    db.quote.findUnique({ where: { id: quoteId } }),
  ]);
  if (!quote || quote.channelId !== channelId) notFound();

  const daysLeft = quote.expiresAt
    ? Math.max(1, Math.ceil((quote.expiresAt.getTime() - Date.now()) / 86_400_000))
    : 30;

  return (
    <BillingEditor
      kind="quote"
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
        id: quote.id,
        number: quote.quoteNumber,
        clientName: quote.clientName,
        clientEmail: quote.clientEmail,
        title: quote.title,
        lineItems:
          parseLineItems(quote.lineItems).length > 0
            ? parseLineItems(quote.lineItems)
            : [
                {
                  item: quote.title,
                  details: "",
                  qty: 1,
                  rateCents: quote.amountCents,
                },
              ],
        taxBps: quote.taxBps,
        discountCents: quote.discountCents,
        paymentTerms: "due-on-receipt",
        validDays: daysLeft,
        notes: quote.notes ?? "",
        terms: quote.terms ?? "",
        status: quote.status,
      }}
    />
  );
}
