import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getChannelAccess } from "@/lib/team-authorization";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { BillingEditor } from "@/components/BillingEditor";
import { emptyBillDraft } from "@/lib/billing";

export const dynamic = "force-dynamic";
export const metadata = { title: "New quote" };

export default async function NewQuotePage({
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
      initial={emptyBillDraft("quote")}
    />
  );
}
