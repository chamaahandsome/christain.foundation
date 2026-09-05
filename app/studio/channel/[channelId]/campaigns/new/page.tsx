import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";
import { CreateCampaignForm } from "@/components/CreateCampaignForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Start a campaign" };

export default async function NewCampaignPage({
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
    FEATURES.CAMPAIGNS,
    ACCESS_LEVELS.MANAGER,
  );
  if (!access.channel || !access.authorized) notFound();

  return <CreateCampaignForm channelId={channelId} />;
}
