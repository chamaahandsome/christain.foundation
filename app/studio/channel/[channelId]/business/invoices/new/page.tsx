import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getChannelAccess } from "@/lib/team-authorization";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { BillingEditor } from "@/components/BillingEditor";
import { emptyBillDraft } from "@/lib/billing";

export const dynamic = "force-dynamic";
export const metadata = { title: "New invoice" };

export default async function NewInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ channelId: string }>;
  searchParams: Promise<{ contractId?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/signin");
  const { channelId } = await params;
  const { contractId } = await searchParams;
  const access = await getChannelAccess(
    userId,
    channelId,
    FEATURES.BUSINESS,
    ACCESS_LEVELS.MANAGER,
  );
  if (!access.channel || !access.authorized) notFound();
  const channel = await db.channel.findUniqueOrThrow({
    where: { id: channelId },
    select: {
      name: true,
      businessLogoUrl: true,
      businessLogoHistory: true,
      businessEmail: true,
      businessAddress: true,
    },
  });

  // ?contractId= pre-fills from the agreement (the Maltivas flow): client,
  // title, and a starting line item at the contract value; the created
  // invoice is linked so it auto-sends when the contract fully signs.
  const contract = contractId
    ? await db.contract.findUnique({
        where: { id: contractId },
        select: {
          id: true,
          channelId: true,
          title: true,
          clientName: true,
          clientEmail: true,
          amountCents: true,
        },
      })
    : null;
  const seeded = emptyBillDraft("invoice");
  if (contract && contract.channelId === channelId) {
    seeded.clientName = contract.clientName;
    seeded.clientEmail = contract.clientEmail;
    seeded.title = contract.title;
    if (contract.amountCents) {
      seeded.lineItems = [
        { item: contract.title, details: "", qty: 1, rateCents: contract.amountCents },
      ];
    }
  }

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
      initial={seeded}
      contractId={contract && contract.channelId === channelId ? contract.id : null}
    />
  );
}
