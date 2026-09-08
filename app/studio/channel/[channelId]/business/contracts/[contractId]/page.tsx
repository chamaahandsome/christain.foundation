import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getChannelAccess } from "@/lib/team-authorization";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { ContractEditorPage } from "@/components/ContractEditorPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contract" };

// The Do-Biz contract editor: header bar, paper canvas, details sidebar.
export default async function ContractEditor({
  params,
}: {
  params: Promise<{ channelId: string; contractId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/signin");
  const { channelId, contractId } = await params;
  const access = await getChannelAccess(
    userId,
    channelId,
    FEATURES.BUSINESS,
    ACCESS_LEVELS.MANAGER,
  );
  if (!access.channel || !access.authorized) notFound();

  const [contract, channel, invoices] = await Promise.all([
    db.contract.findUnique({
      where: { id: contractId },
      include: {
        // fetched wide, collapsed per-day below
        activities: { orderBy: { createdAt: "desc" }, take: 200 },
        signTokens: {
          where: { usedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    db.channel.findUniqueOrThrow({
      where: { id: channelId },
      select: {
        name: true,
        digitalSignature: true,
        digitalSignatureName: true,
        businessLogoUrl: true,
        businessLogoHistory: true,
      },
    }),
    // Linkable invoices: drafts, plus whatever is already linked here.
    db.invoice.findMany({
      where: { channelId, status: { in: ["draft", "sent"] } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        invoiceNumber: true,
        title: true,
        amountCents: true,
        status: true,
        contractId: true,
      },
    }),
  ]);
  if (!contract || contract.channelId !== channelId) notFound();

  return (
    <ContractEditorPage
      channelId={channelId}
      channelName={channel.name}
      hasSignature={Boolean(channel.digitalSignature)}
      signatureImage={channel.digitalSignature}
      invoices={invoices}
      logoHistory={
        Array.isArray(channel.businessLogoHistory)
          ? (channel.businessLogoHistory as string[]).filter(
              (u): u is string => typeof u === "string",
            )
          : []
      }
      contract={{
        id: contract.id,
        contractNumber: contract.contractNumber,
        title: contract.title,
        clientName: contract.clientName,
        clientEmail: contract.clientEmail,
        clientCompany: contract.clientCompany,
        recipients: contract.recipients,
        amountCents: contract.amountCents,
        status: contract.status,
        content: contract.content,
        logoUrl: contract.logoUrl,
        signLink: contract.signTokens[0]
          ? `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/sign/${contract.signTokens[0].token}`
          : null,
        // Same action on the same day collapses to one row with a count —
        // "Draft edited ×14" instead of fourteen identical lines.
        activities: Object.values(
          contract.activities.reduce<
            Record<string, { id: string; description: string; date: string; n: number }>
          >((acc, a) => {
            const date = a.createdAt.toLocaleDateString();
            const key = `${a.description}|${date}`;
            if (acc[key]) acc[key].n += 1;
            else acc[key] = { id: a.id, description: a.description, date, n: 1 };
            return acc;
          }, {}),
        ).map((g) => ({
          id: g.id,
          description: g.n > 1 ? `${g.description} ×${g.n}` : g.description,
          date: g.date,
        })),
      }}
    />
  );
}
