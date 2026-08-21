import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { FEATURES } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";
import { TeamManager } from "@/components/TeamManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team" };

export default async function TeamTab({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/signin");

  const { channelId } = await params;
  const access = await getChannelAccess(userId, channelId, FEATURES.TEAM);
  if (!access.channel) notFound();
  if (!access.isOwner && !access.authorized) notFound();

  return (
    <section className="mt-6">
      <p className="text-sm text-neutral-500">
        Ministry staff can run the channel with per-feature access: the library
        without the team, viewing without editing.
        {access.isOwner
          ? " Invitations are links — copy one and send it to the person yourself."
          : " Only the channel owner can change the roster."}
      </p>
      <TeamManager channelId={channelId} />
    </section>
  );
}
