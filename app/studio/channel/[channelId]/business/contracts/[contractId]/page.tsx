import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getChannelAccess } from "@/lib/team-authorization";
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
  const access = await getChannelAccess(userId, channelId);
  if (!access.channel || !access.isOwner) notFound();

  const [contract, channel] = await Promise.all([
    db.contract.findUnique({
      where: { id: contractId },
      include: {
        activities: { orderBy: { createdAt: "desc" }, take: 20 },
        signTokens: {
          where: { usedAt: null, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    db.channel.findUniqueOrThrow({
      where: { id: channelId },
      select: { name: true, digitalSignature: true, digitalSignatureName: true },
    }),
  ]);
  if (!contract || contract.channelId !== channelId) notFound();

  return (
    <ContractEditorPage
      channelId={channelId}
      channelName={channel.name}
      hasSignature={Boolean(channel.digitalSignature)}
      signatureImage={channel.digitalSignature}
      contract={{
        id: contract.id,
        contractNumber: contract.contractNumber,
        title: contract.title,
        clientName: contract.clientName,
        clientEmail: contract.clientEmail,
        clientCompany: contract.clientCompany,
        amountCents: contract.amountCents,
        status: contract.status,
        content: contract.content,
        signLink: contract.signTokens[0]
          ? `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/sign/${contract.signTokens[0].token}`
          : null,
        activities: contract.activities.map((a) => ({
          id: a.id,
          description: a.description,
          date: a.createdAt.toLocaleDateString(),
        })),
      }}
    />
  );
}
